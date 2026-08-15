import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_LABELS,
  type Dealer,
  type Quotation,
  type QuotationAddon,
  type QuotationItem,
} from "@/lib/types";
import { convertAmount, formatMoney } from "@/lib/fx/frankfurter";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusSelect } from "@/components/quotations/status-select";
import { parseAccessories } from "@/lib/accessories";
import { VersionThread } from "@/components/quotations/version-thread";
import { Separator } from "@/components/ui/separator";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quotation, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quotation) notFound();

  const q = quotation as Quotation;
  const rootId = q.parent_quotation_id ?? q.id;

  const [
    { data: items },
    { data: quotationAddons },
    { data: dealer },
    { data: versions },
    { data: creator },
  ] = await Promise.all([
    supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sort_order"),
    supabase.from("quotation_addons").select("*").eq("quotation_id", id),
    q.dealer_id
      ? supabase
          .from("dealers")
          .select("*")
          .eq("id", q.dealer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("quotations")
      .select("id, quotation_number, version, status, created_at")
      .or(`id.eq.${rootId},parent_quotation_id.eq.${rootId}`)
      .order("version", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", q.created_by)
      .maybeSingle(),
  ]);

  const lineItems = (items ?? []) as QuotationItem[];
  const addons = (quotationAddons ?? []) as QuotationAddon[];
  const dealerRow = dealer as Dealer | null;
  const displayTotal = convertAmount(
    Number(q.total_amount ?? 0),
    q.currency,
    q.fx_rate_used,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {q.quotation_number}
            </h1>
            <Badge variant="secondary">{STATUS_LABELS[q.status]}</Badge>
            <Badge variant="outline">v{q.version}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {q.client_name || "—"}
            {q.client_company ? ` · ${q.client_company}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            variant="outline"
            href={`/api/pdf/${q.id}`}
            target="_blank"
          >
            Download PDF
          </ButtonLink>
          <ButtonLink variant="outline" href={`/quotations/${q.id}/edit`}>
            Edit
          </ButtonLink>
          <ButtonLink variant="ghost" href="/quotations">
            Back to list
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Header</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-slate-500">Currency</p>
                <p className="font-medium">{q.currency}</p>
              </div>
              {q.currency === "USD" ? (
                <div>
                  <p className="text-slate-500">FX rate (INR/USD)</p>
                  <p className="font-medium tabular-nums">
                    {q.fx_rate_used != null
                      ? Number(q.fx_rate_used).toFixed(4)
                      : "—"}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-slate-500">Total</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(displayTotal, q.currency)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Validity</p>
                <p className="font-medium">
                  {q.validity_date
                    ? new Date(q.validity_date).toLocaleDateString("en-IN")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Follow-up</p>
                <p className="font-medium">
                  {q.follow_up_date
                    ? new Date(q.follow_up_date).toLocaleDateString("en-IN")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Dealer sale</p>
                <p className="font-medium">
                  {q.is_dealer_sale
                    ? dealerRow
                      ? `${dealerRow.dealer_name}${
                          dealerRow.company_name
                            ? ` (${dealerRow.company_name})`
                            : ""
                        }`
                      : "Yes"
                    : "No"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Prepared by</p>
                <p className="font-medium">
                  {q.prepared_by_name || creator?.full_name || "—"}
                  {q.prepared_by_email ? (
                    <span className="block text-xs font-normal text-slate-500">
                      {q.prepared_by_email}
                    </span>
                  ) : null}
                  {q.prepared_by_phone ? (
                    <span className="block text-xs font-normal text-slate-500">
                      {q.prepared_by_phone}
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Created</p>
                <p className="font-medium">
                  {new Date(q.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-sm text-slate-500">No items.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Line</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => {
                      const line =
                        Number(item.unit_price) * Number(item.quantity);
                      const displayLine = convertAmount(
                        line,
                        q.currency,
                        q.fx_rate_used,
                      );
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.product_name || "—"}
                            </div>
                            {item.model_no ? (
                              <div className="text-xs text-slate-500">
                                {item.model_no}
                              </div>
                            ) : null}
                            {parseAccessories(item.standard_accessories).length ? (
                              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                                {parseAccessories(item.standard_accessories).map(
                                  (a) => (
                                    <li key={a.name}>
                                      {a.name} × {a.qty}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : null}
                          </TableCell>
                          <TableCell className="capitalize">
                            {item.price_tier}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatMoney(
                              convertAmount(
                                Number(item.unit_price),
                                q.currency,
                                q.fx_rate_used,
                              ),
                              q.currency,
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatMoney(displayLine, q.currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {addons.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Add-ons</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Option</TableHead>
                      <TableHead>Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addons.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.addon_name || "—"}
                        </TableCell>
                        <TableCell>{a.selected_option || "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {a.price != null
                            ? formatMoney(
                                convertAmount(
                                  Number(a.price),
                                  q.currency,
                                  q.fx_rate_used,
                                ),
                                q.currency,
                              )
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {q.terms_snapshot ? (
            <Card>
              <CardHeader>
                <CardTitle>Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                  {q.terms_snapshot}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusSelect
                quotationId={q.id}
                status={q.status}
                statusCustom={q.status_custom}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versions</CardTitle>
            </CardHeader>
            <CardContent>
              <VersionThread
                versions={(versions ?? []) as Quotation[]}
                currentId={q.id}
              />
            </CardContent>
          </Card>

          <Separator />
          <p className="text-xs text-slate-500">
            Editing creates a new version (e.g. RLE-300-1). The original is
            preserved.
          </p>
        </div>
      </div>
    </div>
  );
}
