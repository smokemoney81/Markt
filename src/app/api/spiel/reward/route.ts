import { NextResponse, type NextRequest } from "next/server";
import { authAndService, gameErrorResponse } from "../_shared";
import { claimReward } from "@/lib/game/shop";

/** POST /api/spiel/reward – gedeckelte Gratis-Belohnung (Rewarded Loop). Body: { adToken?: string } */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await authAndService();
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => ({}));
  const adToken = typeof body?.adToken === "string" ? body.adToken : undefined;
  try {
    return NextResponse.json(await claimReward(ctx.service, ctx.userId, adToken));
  } catch (err) {
    return gameErrorResponse(err);
  }
}
