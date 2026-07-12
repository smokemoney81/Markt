import { handleGameAction } from "../_shared";

/** POST /api/spiel/daily – Tagesbonus einlösen. */
export async function POST() {
  return handleGameAction({ type: "daily" });
}
