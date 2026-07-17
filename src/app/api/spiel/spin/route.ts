import { type NextRequest } from "next/server";
import { handleGameAction } from "../_shared";

/** POST /api/spiel/spin – ein Spin, autoritativ serverseitig gewürfelt. Body: { bet?: number } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // bet ist optional (Fallback: gespeicherte Wette). Nur endliche Zahlen
  // durchlassen – NaN/Infinity werden ignoriert (Konsistenz zu build/bet).
  const bet = Number.isFinite(body?.bet) ? (body.bet as number) : undefined;
  return handleGameAction({ type: "spin", bet });
}
