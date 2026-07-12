import { type NextRequest } from "next/server";
import { handleGameAction } from "../_shared";

/** POST /api/spiel/build – Dorf-Objekt bauen/reparieren. Body: { slot: number } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slot = Number(body?.slot);
  if (!Number.isInteger(slot)) {
    return Response.json({ error: "slot fehlt.", code: "UNGUELTIGER_SLOT" }, { status: 400 });
  }
  return handleGameAction({ type: "build", slot });
}
