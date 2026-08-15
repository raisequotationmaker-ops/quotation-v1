"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Currency } from "@/lib/types";
import { QUOTATION_STATUSES, STATUS_LABELS } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProfileOption = { id: string; full_name: string | null };

export function QuotationsFilters({
  salespeople,
}: {
  salespeople: ProfileOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `/quotations?${qs}` : "/quotations");
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(v) => setParam("status", v)}
          items={{
            all: "All",
            ...Object.fromEntries(
              QUOTATION_STATUSES.map((s) => [s, STATUS_LABELS[s]]),
            ),
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {QUOTATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Currency</Label>
        <Select
          value={searchParams.get("currency") ?? "all"}
          onValueChange={(v) => setParam("currency", v as Currency | "all")}
          items={{ all: "All", INR: "INR", USD: "USD" }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="INR">INR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Dealer sale</Label>
        <Select
          value={searchParams.get("dealer") ?? "all"}
          onValueChange={(v) => setParam("dealer", v)}
          items={{ all: "All", yes: "Dealer", no: "Direct" }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Dealer</SelectItem>
            <SelectItem value="no">Direct</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Salesperson</Label>
        <Select
          value={searchParams.get("salesperson") ?? "all"}
          onValueChange={(v) => setParam("salesperson", v)}
          items={{
            all: "All",
            ...Object.fromEntries(
              salespeople.map((p) => [
                p.id,
                p.full_name || p.id.slice(0, 8),
              ]),
            ),
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {salespeople.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.push("/quotations")}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
