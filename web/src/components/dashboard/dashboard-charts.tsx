"use client";

import { STATUS_LABELS, type QuotationStatus } from "@/lib/types";

const STATUS_HEX: Record<QuotationStatus, string> = {
  submitted: "#53617A",
  processing: "#E48B59",
  pending: "#8B95A7",
  converted: "#ED7B46",
  sale_cancelled: "#111827",
};

export type DashboardPoint = {
  status: QuotationStatus;
  created_at: string;
  total_amount: number | null;
  currency: "INR" | "USD";
  is_dealer_sale: boolean;
};

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

export function DashboardCharts({ rows }: { rows: DashboardPoint[] }) {
  const counts = {
    submitted: 0,
    processing: 0,
    pending: 0,
    converted: 0,
    sale_cancelled: 0,
  } as Record<QuotationStatus, number>;
  let dealer = 0;
  let client = 0;
  const monthMap = new Map<string, number>();

  for (const row of rows) {
    counts[row.status] += 1;
    if (row.is_dealer_sale) dealer += 1;
    else client += 1;
    const key = monthKey(row.created_at);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  const statusEntries = (Object.keys(counts) as QuotationStatus[]).map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    value: counts[s],
    color: STATUS_HEX[s],
  }));
  const maxStatus = Math.max(1, ...statusEntries.map((s) => s.value));
  const total = rows.length;

  const months = [...monthMap.keys()].sort().slice(-6);
  const maxMonth = Math.max(1, ...months.map((m) => monthMap.get(m) ?? 0));

  const donut = buildDonut(statusEntries.filter((s) => s.value > 0), total);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        <h2 className="text-sm font-medium text-foreground">Quotes by status</h2>
        <p className="mb-4 font-mono text-[12px] text-muted-foreground">
          {total} total quotations
        </p>
        <div className="space-y-3">
          {statusEntries.map((s) => (
            <div key={s.key} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2">
              <span className="truncate font-mono text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                {s.label}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(s.value / maxStatus) * 100}%`,
                    background: s.color,
                  }}
                />
              </div>
              <span className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        <h2 className="text-sm font-medium text-foreground">Status mix</h2>
        <p className="mb-4 font-mono text-[12px] text-muted-foreground">
          Share of each status
        </p>
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" className="size-36 shrink-0">
            {donut.length === 0 ? (
              <circle cx="60" cy="60" r="42" fill="#D8DADF" />
            ) : (
              donut.map((seg) => (
                <path key={seg.label} d={seg.d} fill={seg.color} />
              ))
            )}
            <circle cx="60" cy="60" r="24" fill="#FFFFFF" />
            <text
              x="60"
              y="64"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#111827"
              fontFamily="ui-monospace, JetBrains Mono, monospace"
            >
              {total}
            </text>
          </svg>
          <ul className="w-full space-y-2 text-xs">
            {statusEntries.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-mono font-semibold tabular-nums text-foreground">
                  {total ? Math.round((s.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        <h2 className="text-sm font-medium text-foreground">Quotes over time</h2>
        <p className="mb-4 font-mono text-[12px] text-muted-foreground">
          Last six months with activity
        </p>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotations yet.</p>
        ) : (
          <div className="flex h-40 items-end gap-2">
            {months.map((m) => {
              const v = monthMap.get(m) ?? 0;
              const h = (v / maxMonth) * 100;
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
                    {v}
                  </span>
                  <div
                    className="w-full rounded-t-sm bg-primary"
                    style={{ height: `${Math.max(h, 6)}%` }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {monthLabel(m)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-secondary p-6 text-secondary-foreground shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-sm font-medium">Sale type</h2>
        <p className="mb-4 font-mono text-[12px] text-white/70">
          Dealer vs direct client
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 p-4">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-wide text-white/70">
              Client
            </p>
            <p className="mt-1 font-mono text-2xl font-medium tabular-nums">{client}</p>
          </div>
          <div className="rounded-xl bg-primary p-4">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-wide text-white/80">
              Dealer
            </p>
            <p className="mt-1 font-mono text-2xl font-medium tabular-nums">{dealer}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildDonut(
  slices: { label: string; value: number; color: string }[],
  total: number,
) {
  if (!total) return [];
  const cx = 60;
  const cy = 60;
  const r = 42;
  let angle = -Math.PI / 2;
  return slices.map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      label: s.label,
      color: s.color,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
    };
  });
}
