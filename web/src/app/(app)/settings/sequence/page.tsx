import { createClient } from "@/lib/supabase/server";
import { SequenceForm } from "@/components/settings/sequence-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SequenceSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("sequence_settings")
    .select("prefix, next_number, updated_at")
    .eq("id", 1)
    .single();

  const prefix = settings?.prefix ?? "RLE";
  const nextNumber = settings?.next_number ?? 300;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Quotation sequence
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Super Admin control for the next root quotation number.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Current sequence</CardTitle>
          <CardDescription>
            Next quotation will use{" "}
            <span className="font-medium text-slate-900">
              {prefix}-{nextNumber}
            </span>
            {settings?.updated_at
              ? ` · updated ${new Date(settings.updated_at).toLocaleString("en-IN")}`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SequenceForm initialNext={nextNumber} />
          <p className="mt-3 text-xs text-slate-500">
            Must be greater than the highest existing root quotation number.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
