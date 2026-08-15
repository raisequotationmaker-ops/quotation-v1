import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/roles";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_system", false)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Users
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Create accounts, reset passwords, and deactivate users.
        </p>
      </div>
      <UsersManager initialProfiles={(profiles ?? []) as Profile[]} />
    </div>
  );
}
