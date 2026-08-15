"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  QUOTATION_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type QuotationStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function StatusSelect({
  quotationId,
  status: initialStatus,
  statusCustom: initialCustom = null,
  compact = false,
}: {
  quotationId: string;
  status: QuotationStatus;
  statusCustom?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [custom, setCustom] = useState(initialCustom ?? "");
  const [savedCustom, setSavedCustom] = useState(initialCustom ?? "");
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(Boolean(initialCustom));
  const [saving, setSaving] = useState(false);

  const display = customMode && savedCustom.trim()
    ? savedCustom.trim()
    : STATUS_LABELS[status];
  const chipClass = customMode && savedCustom.trim()
    ? "bg-primary/15 text-[#9a4e28] ring-primary/30"
    : STATUS_COLORS[status];

  async function save(next: {
    status?: QuotationStatus;
    status_custom?: string | null;
  }) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("quotations")
      .update(next)
      .eq("id", quotationId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function pickPreset(next: QuotationStatus) {
    setCustomMode(false);
    setCustom("");
    setSavedCustom("");
    setStatus(next);
    const ok = await save({ status: next, status_custom: null });
    if (!ok) return;
    setOpen(false);
    toast.success(`Status set to ${STATUS_LABELS[next]}`);
  }

  async function saveCustom() {
    const next = custom.trim();
    if (!next) {
      toast.error("Enter a custom status or pick a preset");
      return;
    }
    const ok = await save({ status_custom: next });
    if (!ok) return;
    setSavedCustom(next);
    setCustomMode(true);
    setOpen(false);
    toast.success("Custom status saved");
  }

  return (
    <div className={cn("relative", compact ? "min-w-[160px]" : "min-w-[200px]")}>
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex w-full items-center justify-between gap-1 rounded-full px-3 py-1 text-left text-xs font-semibold ring-1 transition",
          chipClass,
          compact ? "h-8" : "h-9 text-sm",
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={cn("size-3.5 shrink-0", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-[min(100vw-2rem,280px)] rounded-2xl border border-border bg-white p-2 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Choose one
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUOTATION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => pickPreset(s)}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-left text-xs font-semibold ring-1 transition hover:brightness-95",
                  STATUS_COLORS[s],
                  !customMode && status === s && "ring-2 ring-slate-800",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => setCustomMode(true)}
            className={cn(
              "mt-1.5 inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold ring-1",
              customMode
                ? "bg-primary/15 text-[#9a4e28] ring-primary/40"
                : "bg-muted text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            <PencilLine className="size-3.5" />
            Custom
          </button>
          {customMode ? (
            <div className="mt-1.5 flex gap-1.5">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveCustom();
                  }
                }}
                placeholder="Type custom status"
                className="h-8 text-xs"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void saveCustom()}
                className="rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground"
              >
                Save
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
