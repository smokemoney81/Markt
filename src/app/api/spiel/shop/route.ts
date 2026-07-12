import { NextResponse } from "next/server";
import { authAndService, gameErrorResponse } from "../_shared";
import { shopOverview } from "@/lib/game/shop";

export const dynamic = "force-dynamic";

/** GET /api/spiel/shop – Katalog + Rewarded-Status + bereits gekaufte Einmal-Produkte. */
export async function GET(): Promise<NextResponse> {
  const ctx = await authAndService();
  if ("error" in ctx) return ctx.error;
  try {
    return NextResponse.json(await shopOverview(ctx.service, ctx.userId));
  } catch (err) {
    return gameErrorResponse(err);
  }
}
