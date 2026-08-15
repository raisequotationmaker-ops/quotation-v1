import { createClient } from "@/lib/supabase/server";
import type { Dealer } from "@/lib/types";
import { DealersManager } from "@/components/dealers/dealers-manager";

export default async function DealersPage() {
  const supabase = await createClient();
  const { data: dealers } = await supabase
    .from("dealers")
    .select("*")
    .order("dealer_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Dealers
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Registered dealers available when marking a quotation as a dealer sale.
        </p>
      </div>
      <DealersManager initialDealers={(dealers ?? []) as Dealer[]} />
    </div>
  );
}
