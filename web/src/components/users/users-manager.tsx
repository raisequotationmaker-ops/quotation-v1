"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Profile, UserRole } from "@/lib/auth/roles";
import { roleLabel } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export function UsersManager({
  initialProfiles,
}: {
  initialProfiles: Profile[];
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(
    initialProfiles.filter((p) => !p.is_system),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("salesperson");
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempOpen, setTempOpen] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          phone: phone || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create user");
      const created = body.profile as Profile;
      if (!created.is_system) {
        setProfiles((prev) => [created, ...prev]);
      }
      setCreateOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setRole("salesperson");
      toast.success("User created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId: string) {
    if (!confirm("Generate a temporary password for this user?")) return;
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Reset failed");
      setTempPassword(body.tempPassword as string);
      setTempOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  async function toggleActive(profile: Profile) {
    if (profile.is_system) {
      toast.error("System accounts cannot be modified");
      return;
    }
    const supabase = createClient();
    const next = !profile.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: next })
      .eq("id", profile.id)
      .eq("is_system", false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, is_active: next } : p)),
    );
    toast.success(next ? "User activated" : "User deactivated");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Create user</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-slate-500">No profiles yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.full_name || "—"}
                    </TableCell>
                    <TableCell>{roleLabel(p.role)}</TableCell>
                    <TableCell>{p.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetPassword(p.id)}
                      >
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant={p.is_active ? "destructive" : "secondary"}
                        onClick={() => toggleActive(p)}
                      >
                        {p.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Creates an Auth user and profile. Share the password securely.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
                items={{
                  salesperson: "Salesperson",
                  admin: "Admin",
                  super_admin: "Super Admin",
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salesperson">Salesperson</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tempOpen} onOpenChange={setTempOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Copy this now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm break-all">
            {tempPassword}
          </p>
          <DialogFooter>
            <Button
              type="button"
              onClick={async () => {
                if (tempPassword) {
                  await navigator.clipboard.writeText(tempPassword);
                  toast.success("Copied");
                }
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
