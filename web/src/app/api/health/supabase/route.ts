import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: "Missing env vars", url: url ?? null },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      cache: "no-store",
    });
    const text = await res.text();
    return NextResponse.json({
      ok: true,
      status: res.status,
      url,
      body: text.slice(0, 200),
    });
  } catch (err) {
    const cause =
      err instanceof Error && "cause" in err
        ? String((err as Error & { cause?: unknown }).cause)
        : null;
    return NextResponse.json(
      {
        ok: false,
        url,
        error: err instanceof Error ? err.message : "fetch failed",
        cause,
      },
      { status: 500 },
    );
  }
}
