import { NextResponse, type NextRequest } from "next/server";
import { authAndService, gameErrorResponse } from "../_shared";
import { purchase } from "@/lib/game/shop";

/** POST /api/spiel/purchase – Kauf ausführen. Body: { productId: string, receipt?: string } */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await authAndService();
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => ({}));
  const productId = String(body?.productId ?? "");
  const receipt = typeof body?.receipt === "string" ? body.receipt : undefined;
  if (!productId) {
    return NextResponse.json({ error: "productId fehlt.", code: "UNBEKANNTES_PRODUKT" }, { status: 400 });
  }
  try {
    return NextResponse.json(await purchase(ctx.service, ctx.userId, productId, receipt));
  } catch (err) {
    return gameErrorResponse(err);
  }
}
