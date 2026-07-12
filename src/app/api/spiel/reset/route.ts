import { handleGameAction } from "../_shared";

/** POST /api/spiel/reset – Spielstand zurücksetzen. */
export async function POST() {
  return handleGameAction({ type: "reset" });
}
