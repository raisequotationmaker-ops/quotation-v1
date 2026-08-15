"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CategoriesManager({
  initialCategories,
  canWrite,
}: {
  initialCategories: Category[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState(initialCategories);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: name.trim(), created_by: user?.id ?? null })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((prev) =>
      [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setName("");
    toast.success("Category created");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Add category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Analytical balances"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-slate-600">View only — Admin or Super Admin can add categories.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">No categories yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {new Date(c.created_at).toLocaleDateString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
