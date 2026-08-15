import Link from "next/link";
import type { Quotation } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function VersionThread({
  versions,
  currentId,
}: {
  versions: Pick<
    Quotation,
    "id" | "quotation_number" | "version" | "status" | "created_at"
  >[];
  currentId: string;
}) {
  if (versions.length === 0) return null;

  return (
    <ul className="space-y-2">
      {versions.map((v) => {
        const active = v.id === currentId;
        return (
          <li key={v.id}>
            <Link
              href={`/quotations/${v.id}`}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <span className="font-medium">
                {v.quotation_number}
                <span
                  className={cn(
                    "ml-2 font-normal",
                    active ? "text-slate-300" : "text-slate-500",
                  )}
                >
                  v{v.version}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={active ? "secondary" : "outline"}>
                  {STATUS_LABELS[v.status]}
                </Badge>
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    active ? "text-slate-300" : "text-slate-500",
                  )}
                >
                  {new Date(v.created_at).toLocaleDateString("en-IN")}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
