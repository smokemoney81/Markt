import { type NextRequest } from "next/server";
import { handleGameAction } from "../_shared";

/** POST /api/spiel/chest – Truhe kaufen & öffnen. Body: { chestId: string } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const chestId = String(body?.chestId ?? "");
  if (!chestId) {
    return Response.json({ error: "chestId fehlt.", code: "UNBEKANNTE_TRUHE" }, { status: 400 });
  }
  return handleGameAction({ type: "chest", chestId });
}
