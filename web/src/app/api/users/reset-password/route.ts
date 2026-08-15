import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!caller?.is_active || caller.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const userId = String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_system")
      .eq("id", userId)
      .maybeSingle();

    // System/creator accounts are invisible via RLS; treat missing or flagged as forbidden
    if (!target || target.is_system) {
      return NextResponse.json(
        { error: "Cannot reset password for this user" },
        { status: 403 },
      );
    }

    const tempPassword = generateTempPassword();
    const { error } = await supabase.rpc("reset_app_user_password", {
      p_user_id: userId,
      p_password: tempPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ tempPassword });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
