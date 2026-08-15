import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/roles";

const ROLES: UserRole[] = ["salesperson", "admin", "super_admin"];

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
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = String(body.full_name ?? "").trim();
    const role = body.role as UserRole;
    const phone =
      body.phone == null || body.phone === ""
        ? null
        : String(body.phone).trim();

    if (!email || !password || !full_name || !ROLES.includes(role)) {
      return NextResponse.json(
        { error: "email, password, full_name, and valid role are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Never allow creating/targeting the reserved creator bootstrap identity
    if (email === "superadmin@raiselabequip.com") {
      return NextResponse.json(
        { error: "This email is reserved" },
        { status: 400 },
      );
    }

    const { data: newId, error: rpcError } = await supabase.rpc(
      "create_app_user",
      {
        p_email: email,
        p_password: password,
        p_full_name: full_name,
        p_role: role,
        p_phone: phone,
      },
    );

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", newId)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message, id: newId },
        { status: 400 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
