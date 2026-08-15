"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Puzzle,
  Tags,
  Package,
  Store,
  Users,
  Hash,
  KeyRound,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppNav({
  role,
  fullName,
}: {
  role: UserRole;
  fullName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const links: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/addons", label: "Add-ons", icon: Puzzle },
  ];

  if (role === "admin" || role === "super_admin") {
    links.push({ href: "/categories", label: "Categories", icon: Tags });
  }

  if (role === "super_admin") {
    links.push(
      { href: "/products", label: "Products", icon: Package },
      { href: "/dealers", label: "Dealers", icon: Store },
      { href: "/users", label: "Users", icon: Users },
      { href: "/settings/sequence", label: "Sequence", icon: Hash },
    );
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
              RLE Quotation Maker
            </p>
            <p className="truncate font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {fullName || "Signed in"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/account/password"
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium transition-colors",
                isActive("/account/password")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <KeyRound className="size-3.5" />
              Account
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
