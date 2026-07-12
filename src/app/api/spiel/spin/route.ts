import { type NextRequest } from "next/server";
import { handleGameAction } from "../_shared";

/** POST /api/spiel/spin – ein Spin, autoritativ serverseitig gewürfelt. Body: { bet?: number } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bet = typeof body?.bet === "number" ? body.bet : undefined;
  return handleGameAction({ type: "spin", bet });
}
