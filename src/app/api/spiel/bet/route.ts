import { type NextRequest } from "next/server";
import { handleGameAction } from "../_shared";

/** POST /api/spiel/bet – Einsatz (Wette) setzen. Body: { bet: number } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bet = Number(body?.bet);
  if (!Number.isInteger(bet)) {
    return Response.json({ error: "bet fehlt.", code: "UNGUELTIGE_WETTE" }, { status: 400 });
  }
  return handleGameAction({ type: "setBet", bet });
}
