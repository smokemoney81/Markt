import { NextResponse, type NextRequest } from "next/server";
import { authAndService, gameErrorResponse } from "../_shared";
import { SHOP_PRODUCTS, assertNotOwned, purchase } from "@/lib/game/shop";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/game/stripe";
import { GameError } from "@/lib/game/server";

/**
 * POST /api/spiel/checkout – startet den Kauf. Body: { productId: string }
 * - Mit Stripe: legt eine Checkout-Session an und liefert `{ url }` zum Weiterleiten.
 * - Ohne Stripe, aber mit PAYMENTS_TEST_MODE: schreibt direkt gut (`{ granted, state }`).
 * - Sonst: 402.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await authAndService();
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const productId = String(body?.productId ?? "");
  const product = SHOP_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return NextResponse.json({ error: "Unbekanntes Produkt.", code: "UNBEKANNTES_PRODUKT" }, { status: 400 });
  }

  try {
    await assertNotOwned(ctx.service, ctx.userId, product);

    if (isStripeConfigured()) {
      const base = appBaseUrl(new URL(req.url).origin);
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: product.currency.toLowerCase(),
              unit_amount: product.priceCents,
              product_data: { name: `Münz-Meister: ${product.label}`, description: product.description },
            },
          },
        ],
        // Gutschrift erfolgt autoritativ im Webhook anhand dieser Metadaten.
        metadata: { userId: ctx.userId, productId: product.id },
        success_url: `${base}/spiel?kauf=erfolg`,
        cancel_url: `${base}/spiel?kauf=abbruch`,
      });
      return NextResponse.json({ url: session.url });
    }

    if (process.env.PAYMENTS_TEST_MODE === "true") {
      const res = await purchase(ctx.service, ctx.userId, product.id);
      return NextResponse.json({ granted: true, state: res.state, product: res.product });
    }

    throw new GameError("ZAHLUNG_NICHT_KONFIGURIERT", "Käufe sind noch nicht aktiviert.");
  } catch (err) {
    return gameErrorResponse(err);
  }
}
