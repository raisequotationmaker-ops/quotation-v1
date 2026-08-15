import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultTermsBody } from "@/lib/fx/frankfurter";
import type { Dealer, Product, ProductAddon, TermsClause } from "@/lib/types";
import { QuotationForm } from "@/components/quotations/quotation-form";

export default async function NewQuotationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: products },
    { data: productAddons },
    { data: dealers },
    { data: profile },
    { data: termsClauses },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase.from("product_addons").select("*").order("sort_order"),
    supabase.from("dealers").select("*").order("dealer_name"),
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", user.id)
      .single(),
    supabase
      .from("terms_clauses")
      .select("id, body, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (!profile) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          New quotation
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Build a quote with products, pricing tier, and add-ons.
        </p>
      </div>
      <QuotationForm
        mode="create"
        products={(products ?? []) as Product[]}
        productAddons={(productAddons ?? []) as ProductAddon[]}
        dealers={(dealers ?? []) as Dealer[]}
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          email: user.email ?? null,
        }}
        termsClauses={(termsClauses ?? []) as TermsClause[]}
        defaultTerms={defaultTermsBody()}
      />
    </div>
  );
}
