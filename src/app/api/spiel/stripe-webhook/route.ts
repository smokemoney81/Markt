import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_PRODUCTS, recordAndGrant } from "@/lib/game/shop";
import { getStripe, isStripeConfigured } from "@/lib/game/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/spiel/stripe-webhook – autoritative Kauf-Gutschrift.
 *
 * Wird von Stripe aufgerufen (nicht vom Client). Die Signatur wird gegen
 * STRIPE_WEBHOOK_SECRET geprüft; erst danach werden die Gegenstände über die
 * Metadaten (userId, productId) gutgeschrieben. Idempotent über die Session-ID.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe-Signaturprüfung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  // Beide Events, bei denen die Zahlung tatsächlich eingegangen ist:
  // - checkout.session.completed: Sofortzahlung (Karte etc.)
  // - checkout.session.async_payment_succeeded: verzögerte Methoden
  //   (z. B. SEPA-Lastschrift), die erst später „paid" werden.
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    // Nur gutschreiben, wenn wirklich bezahlt wurde. `completed` feuert auch
    // für Sessions mit noch offener asynchroner Zahlung (payment_status
    // 'unpaid') – diese dürfen NICHT gutgeschrieben werden.
    if (session.payment_status !== "paid") {
      console.warn("Stripe-Webhook ohne bezahlten Status ignoriert:", session.id, session.payment_status);
      return NextResponse.json({ received: true });
    }

    const userId = session.metadata?.userId;
    const productId = session.metadata?.productId;
    const product = SHOP_PRODUCTS.find((p) => p.id === productId);

    if (userId && product) {
      // Betrag gegen den Katalogpreis abgleichen: Bei Manipulation der Session
      // (falscher Betrag) NICHT gutschreiben, sondern nur protokollieren.
      const amountTotal = session.amount_total ?? 0;
      if (amountTotal !== product.priceCents) {
        console.error(
          "Stripe-Webhook: Betrag weicht vom Katalogpreis ab, keine Gutschrift.",
          { session: session.id, product: product.id, amountTotal, expected: product.priceCents },
        );
        return NextResponse.json({ received: true });
      }

      try {
        await recordAndGrant(
          createServiceClient(),
          userId,
          product,
          "stripe",
          session.id,
          amountTotal,
        );
      } catch (err) {
        // Fehler NICHT als 2xx quittieren → Stripe wiederholt (Gutschrift ist idempotent).
        console.error("Kauf-Gutschrift fehlgeschlagen:", err);
        return NextResponse.json({ error: "Gutschrift fehlgeschlagen." }, { status: 500 });
      }
    } else {
      console.warn("Stripe-Webhook ohne gültige Metadaten:", session.id);
    }
  }

  return NextResponse.json({ received: true });
}
