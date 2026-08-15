import { createClient } from "@/lib/supabase/server";
import { canSeeCompanyDashboard } from "@/lib/auth/roles";
import {
  QUOTATION_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type QuotationStatus,
} from "@/lib/types";
import { ButtonLink } from "@/components/ui/button-link";
import {
  DashboardCharts,
  type DashboardPoint,
} from "@/components/dashboard/dashboard-charts";

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user!.id)
    .single();

  const role = profile!.role;
  const showCompany = canSeeCompanyDashboard(role);

  const { data: quoteRows } = await supabase
    .from("quotations")
    .select("status, currency, total_amount, created_at, is_dealer_sale");

  const rows = (quoteRows ?? []) as DashboardPoint[];
  const counts = Object.fromEntries(
    QUOTATION_STATUSES.map((s) => [s, 0]),
  ) as Record<QuotationStatus, number>;
  for (const row of rows) {
    counts[row.status] += 1;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthQuotedInr = showCompany
    ? rows
        .filter(
          (r) =>
            r.currency === "INR" &&
            new Date(r.created_at) >= monthStart,
        )
        .reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            System metrics
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showCompany
              ? "Company-wide quotation overview."
              : `Your quotations, ${profile?.full_name || "salesperson"}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="outline" href="/quotations">
            View quotations
          </ButtonLink>
          <ButtonLink href="/quotations/new">New quotation</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-2xl bg-secondary p-6 text-secondary-foreground shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
            Total
          </p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums">
            {rows.length}
          </p>
        </div>
        {QUOTATION_STATUSES.map((status) => (
          <div
            key={status}
            className={`rounded-2xl border p-6 shadow-[0_8px_24px_rgba(17,24,39,0.04)] ${STATUS_COLORS[status]}`}
          >
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] opacity-80">
              {STATUS_LABELS[status]}
            </p>
            <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-foreground">
              {counts[status]}
            </p>
          </div>
        ))}
      </div>

      {showCompany ? (
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-[0_8px_24px_rgba(228,139,89,0.25)]">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">
            Quoted this month · INR
          </p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums">
            {formatInr(monthQuotedInr)}
          </p>
        </div>
      ) : null}

      <DashboardCharts rows={rows} />
    </div>
  );
}
