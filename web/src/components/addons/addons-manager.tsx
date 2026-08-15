"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Addon, AddonType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function parseOptions(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionsToString(options: string[] | null): string {
  if (!options?.length) return "";
  return options.join(", ");
}

export function AddonsManager({
  initialAddons,
}: {
  initialAddons: Addon[];
}) {
  const router = useRouter();
  const [addons, setAddons] = useState(initialAddons);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AddonType>("checkbox");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setType("checkbox");
    setOptionsRaw("");
    setDefaultPrice("");
    setOpen(true);
  }

  function openEdit(a: Addon) {
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setOptionsRaw(optionsToString(a.options));
    setDefaultPrice(a.default_price != null ? String(a.default_price) : "");
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const options =
      type === "radio" ? parseOptions(optionsRaw) : null;

    if (type === "radio" && (!options || options.length < 2)) {
      setSaving(false);
      toast.error("Radio add-ons need at least two comma-separated options");
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      options,
      default_price: defaultPrice === "" ? null : Number(defaultPrice),
      created_by: editing?.created_by ?? user?.id ?? null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("addons")
        .update(payload)
        .eq("id", editing.id)
        .select("*")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setAddons((prev) =>
        prev
          .map((a) => (a.id === editing.id ? (data as Addon) : a))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      toast.success("Add-on updated");
    } else {
      const { data, error } = await supabase
        .from("addons")
        .insert(payload)
        .select("*")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setAddons((prev) =>
        [...prev, data as Addon].sort((a, b) => a.name.localeCompare(b.name)),
      );
      toast.success("Add-on created");
    }
    setOpen(false);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this add-on?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("addons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAddons((prev) => prev.filter((a) => a.id !== id));
    toast.success("Add-on deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>Add add-on</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All add-ons</CardTitle>
        </CardHeader>
        <CardContent>
          {addons.length === 0 ? (
            <p className="text-sm text-slate-500">No add-ons yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Default price</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {addons.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {a.options?.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {a.default_price != null ? a.default_price : "—"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(a.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit add-on" : "New add-on"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addon-name">Name</Label>
              <Input
                id="addon-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={type === "checkbox"}
                    onCheckedChange={(checked) => {
                      if (checked) setType("checkbox");
                    }}
                  />
                  Checkbox
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={type === "radio"}
                    onCheckedChange={(checked) => {
                      if (checked) setType("radio");
                    }}
                  />
                  Radio
                </label>
              </div>
            </div>
            {type === "radio" ? (
              <div className="space-y-2">
                <Label htmlFor="options">Options (comma-separated)</Label>
                <Input
                  id="options"
                  required
                  value={optionsRaw}
                  onChange={(e) => setOptionsRaw(e.target.value)}
                  placeholder="Included, Not included"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="default_price">Default price</Label>
              <Input
                id="default_price"
                type="number"
                min="0"
                step="0.01"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
