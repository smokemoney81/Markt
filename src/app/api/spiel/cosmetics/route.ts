import { NextResponse } from "next/server";
import { COSMETIC_THEMES } from "@/lib/game/coinmaster";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    themes: Object.entries(COSMETIC_THEMES).map(([key, val]) => ({
      id: key,
      name: val.name,
      unlock: val.unlock,
    })),
  });
}
