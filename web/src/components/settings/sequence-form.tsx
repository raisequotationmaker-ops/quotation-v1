"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SequenceForm({ initialNext }: { initialNext: number }) {
  const router = useRouter();
  const [nextNumber, setNextNumber] = useState(String(initialNext));
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(nextNumber);
    if (!Number.isFinite(value) || value < 1) {
      toast.error("Enter a positive integer");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_sequence_next_number", {
      p_next: value,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sequence updated");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1 space-y-2">
        <Label htmlFor="next_number">Set next number</Label>
        <Input
          id="next_number"
          type="number"
          min={1}
          required
          value={nextNumber}
          onChange={(e) => setNextNumber(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Updating…" : "Update"}
      </Button>
    </form>
  );
}
