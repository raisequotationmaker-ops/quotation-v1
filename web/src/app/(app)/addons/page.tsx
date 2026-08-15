import { createClient } from "@/lib/supabase/server";
import type { Addon } from "@/lib/types";
import { AddonsManager } from "@/components/addons/addons-manager";

export default async function AddonsPage() {
  const supabase = await createClient();
  const { data: addons } = await supabase
    .from("addons")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Add-ons
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Reusable checkbox or radio options for quotations.
        </p>
      </div>
      <AddonsManager initialAddons={(addons ?? []) as Addon[]} />
    </div>
  );
}
