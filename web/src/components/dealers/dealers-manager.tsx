"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Dealer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const emptyForm = {
  dealer_reg_no: "",
  dealer_name: "",
  company_name: "",
  gst_no: "",
  address: "",
  contact_person: "",
  phone: "",
  email: "",
};

export function DealersManager({
  initialDealers,
}: {
  initialDealers: Dealer[];
}) {
  const router = useRouter();
  const [dealers, setDealers] = useState(initialDealers);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Dealer) {
    setEditing(d);
    setForm({
      dealer_reg_no: d.dealer_reg_no,
      dealer_name: d.dealer_name,
      company_name: d.company_name ?? "",
      gst_no: d.gst_no ?? "",
      address: d.address ?? "",
      contact_person: d.contact_person ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      dealer_reg_no: form.dealer_reg_no.trim(),
      dealer_name: form.dealer_name.trim(),
      company_name: form.company_name.trim() || null,
      gst_no: form.gst_no.trim() || null,
      address: form.address.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      created_by: editing?.created_by ?? user?.id ?? null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("dealers")
        .update(payload)
        .eq("id", editing.id)
        .select("*")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setDealers((prev) =>
        prev
          .map((d) => (d.id === editing.id ? (data as Dealer) : d))
          .sort((a, b) => a.dealer_name.localeCompare(b.dealer_name)),
      );
      toast.success("Dealer updated");
    } else {
      const { data, error } = await supabase
        .from("dealers")
        .insert(payload)
        .select("*")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setDealers((prev) =>
        [...prev, data as Dealer].sort((a, b) =>
          a.dealer_name.localeCompare(b.dealer_name),
        ),
      );
      toast.success("Dealer created");
    }
    setOpen(false);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this dealer?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("dealers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDealers((prev) => prev.filter((d) => d.id !== id));
    toast.success("Dealer deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>Add dealer</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dealer registry</CardTitle>
        </CardHeader>
        <CardContent>
          {dealers.length === 0 ? (
            <p className="text-sm text-slate-500">No dealers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg no</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.dealer_reg_no}</TableCell>
                    <TableCell>{d.dealer_name}</TableCell>
                    <TableCell>{d.company_name || "—"}</TableCell>
                    <TableCell>{d.phone || "—"}</TableCell>
                    <TableCell>{d.email || "—"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(d.id)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit dealer" : "Add dealer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dealer_reg_no">Reg no</Label>
              <Input
                id="dealer_reg_no"
                required
                value={form.dealer_reg_no}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dealer_reg_no: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer_name">Name</Label>
              <Input
                id="dealer_name"
                required
                value={form.dealer_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dealer_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company_name">Company</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_no">GST</Label>
              <Input
                id="gst_no"
                value={form.gst_no}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gst_no: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact</Label>
              <Input
                id="contact_person"
                value={form.contact_person}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_person: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={3}
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <DialogFooter className="sm:col-span-2">
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
