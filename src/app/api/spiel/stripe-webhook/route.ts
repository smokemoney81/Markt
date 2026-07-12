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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const productId = session.metadata?.productId;
    const product = SHOP_PRODUCTS.find((p) => p.id === productId);

    if (userId && product) {
      try {
        await recordAndGrant(
          createServiceClient(),
          userId,
          product,
          "stripe",
          session.id,
          session.amount_total ?? product.priceCents,
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
