import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canSeeCompanyDashboard } from "@/lib/auth/roles";
import {
  type Currency,
  type Quotation,
  type QuotationStatus,
} from "@/lib/types";
import { convertAmount, formatMoney } from "@/lib/fx/frankfurter";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuotationsFilters } from "@/components/quotations/quotations-filters";
import { StatusSelect } from "@/components/quotations/status-select";

const PAGE_SIZE = 50;

const LIST_COLUMNS =
  "id, quotation_number, status, status_custom, client_name, client_company, currency, total_amount, fx_rate_used, created_at, created_by, is_dealer_sale, version, profiles!created_by(full_name)";

type QuotationRow = Pick<
  Quotation,
  | "id"
  | "quotation_number"
  | "status"
  | "status_custom"
  | "client_name"
  | "client_company"
  | "currency"
  | "total_amount"
  | "fx_rate_used"
  | "created_at"
  | "created_by"
  | "is_dealer_sale"
  | "version"
> & {
  profiles: { full_name: string | null } | null;
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isSuperAdmin = canSeeCompanyDashboard(profile!.role);
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("quotations")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const status =
    typeof params.status === "string" ? (params.status as QuotationStatus) : null;
  const currency =
    typeof params.currency === "string" ? (params.currency as Currency) : null;
  const dealer =
    typeof params.dealer === "string" ? params.dealer : null;
  const salesperson =
    typeof params.salesperson === "string" ? params.salesperson : null;

  if (isSuperAdmin) {
    if (status) query = query.eq("status", status);
    if (currency) query = query.eq("currency", currency);
    if (dealer === "yes") query = query.eq("is_dealer_sale", true);
    if (dealer === "no") query = query.eq("is_dealer_sale", false);
    if (salesperson) query = query.eq("created_by", salesperson);
  }

  const { data: quotations, count } = await query;
  const rows = (quotations ?? []) as unknown as QuotationRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let salespeople: { id: string; full_name: string | null }[] = [];
  if (isSuperAdmin) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .eq("is_system", false)
      .order("full_name");
    salespeople = profiles ?? [];
  }

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (currency) qs.set("currency", currency);
  if (dealer) qs.set("dealer", dealer);
  if (salesperson) qs.set("salesperson", salesperson);
  const baseQs = qs.toString();
  const hrefFor = (p: number) => {
    const next = new URLSearchParams(baseQs);
    if (p > 1) next.set("page", String(p));
    const s = next.toString();
    return s ? `/quotations?${s}` : "/quotations";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Quotations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSuperAdmin
              ? "Company-wide quotation list."
              : "Your quotations."}
          </p>
        </div>
        <ButtonLink href="/quotations/new">New Quotation</ButtonLink>
      </div>

      {isSuperAdmin ? (
        <Suspense fallback={null}>
          <QuotationsFilters salespeople={salespeople} />
        </Suspense>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No quotations yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    {isSuperAdmin ? <TableHead>Salesperson</TableHead> : null}
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((q) => {
                    const display = convertAmount(
                      Number(q.total_amount ?? 0),
                      q.currency,
                      q.fx_rate_used,
                    );
                    return (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Link
                            href={`/quotations/${q.id}`}
                            className="font-medium text-slate-900 underline-offset-2 hover:underline"
                          >
                            {q.quotation_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {q.client_name || "—"}
                          </div>
                          {q.client_company ? (
                            <div className="text-xs text-slate-500">
                              {q.client_company}
                            </div>
                          ) : null}
                        </TableCell>
                        {isSuperAdmin ? (
                          <TableCell>
                            {q.profiles?.full_name || "—"}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <StatusSelect
                            quotationId={q.id}
                            status={q.status}
                            statusCustom={q.status_custom}
                            compact
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(display, q.currency)}
                        </TableCell>
                        <TableCell className="tabular-nums text-slate-600">
                          {new Date(q.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          v{q.version}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>
                    Page {page} of {totalPages} ({total} quotes)
                  </span>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Link className="underline" href={hrefFor(page - 1)}>
                        Previous
                      </Link>
                    ) : null}
                    {page < totalPages ? (
                      <Link className="underline" href={hrefFor(page + 1)}>
                        Next
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
