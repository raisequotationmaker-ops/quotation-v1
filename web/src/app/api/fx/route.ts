import { NextResponse } from "next/server";
import { fetchFrankfurterInrPerUsd } from "@/lib/fx/frankfurter";

export async function GET() {
  try {
    const inrPerUsd = await fetchFrankfurterInrPerUsd();
    return NextResponse.json({ inrPerUsd });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "FX rate unavailable",
      },
      { status: 503 },
    );
  }
}
