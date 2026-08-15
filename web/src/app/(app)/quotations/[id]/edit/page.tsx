import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultTermsBody } from "@/lib/fx/frankfurter";
import type {
  Dealer,
  Product,
  ProductAddon,
  Quotation,
  QuotationAddon,
  QuotationItem,
  TermsClause,
} from "@/lib/types";
import { QuotationForm } from "@/components/quotations/quotation-form";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quotation } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!quotation) notFound();
  const q = quotation as Quotation;

  const [
    { data: items },
    { data: selectedAddons },
    { data: products },
    { data: productAddons },
    { data: dealers },
    { data: profile },
    { data: termsClauses },
  ] = await Promise.all([
    supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sort_order"),
    supabase.from("quotation_addons").select("*").eq("quotation_id", id),
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

  // Ensure products referenced by inactive catalog items still appear in the form
  const activeProducts = (products ?? []) as Product[];
  const itemRows = (items ?? []) as QuotationItem[];
  const missingIds = itemRows
    .map((i) => i.product_id)
    .filter((pid): pid is string => Boolean(pid))
    .filter((pid) => !activeProducts.some((p) => p.id === pid));

  let productsForForm = activeProducts;
  if (missingIds.length > 0) {
    const { data: extras } = await supabase
      .from("products")
      .select("*")
      .in("id", missingIds);
    productsForForm = [
      ...activeProducts,
      ...((extras ?? []) as Product[]),
    ];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Edit {q.quotation_number}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Saving creates a new version. The current quote is left unchanged.
        </p>
      </div>
      <QuotationForm
        mode="edit"
        sourceQuotationId={q.id}
        products={productsForForm}
        productAddons={(productAddons ?? []) as ProductAddon[]}
        dealers={(dealers ?? []) as Dealer[]}
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          email: user.email ?? null,
        }}
        termsClauses={(termsClauses ?? []) as TermsClause[]}
        defaultTerms={q.terms_snapshot || defaultTermsBody()}
        initial={{
          client_name: q.client_name,
          client_company: q.client_company,
          client_address: q.client_address,
          currency: q.currency,
          fx_rate_used: q.fx_rate_used,
          is_dealer_sale: q.is_dealer_sale,
          dealer_id: q.dealer_id,
          follow_up_date: q.follow_up_date,
          validity_date: q.validity_date,
          items: itemRows.map((item) => ({
            product_id: item.product_id,
            price_tier: item.price_tier,
            unit_price: Number(item.unit_price),
            quantity: item.quantity,
            image_layout_override: item.image_layout_override,
          })),
          selectedAddons: ((selectedAddons ?? []) as QuotationAddon[]).map(
            (a) => ({
              product_addon_id: a.product_addon_id,
              addon_name: a.addon_name,
              selected_option: a.selected_option,
              price: a.price != null ? Number(a.price) : null,
              itemIndex: itemRows.findIndex((it) => it.id === a.quotation_item_id),
            }),
          ),
        }}
      />
    </div>
  );
}
