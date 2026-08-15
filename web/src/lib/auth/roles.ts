export type UserRole = "salesperson" | "admin" | "super_admin";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
};

export const SUPER_ADMIN_ONLY_PREFIXES = [
  "/products",
  "/dealers",
  "/users",
  "/settings",
] as const;

export const ADMIN_WRITE_PREFIXES = ["/categories"] as const;

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (SUPER_ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return role === "super_admin";
  }
  if (ADMIN_WRITE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Salespeople can view categories list is optional; write is admin+. Allow read for all authenticated in UI.
    return true;
  }
  return true;
}

export function canManageProducts(role: UserRole) {
  return role === "super_admin";
}

export function canManageDealers(role: UserRole) {
  return role === "super_admin";
}

export function canManageUsers(role: UserRole) {
  return role === "super_admin";
}

export function canManageCategories(role: UserRole) {
  return role === "admin" || role === "super_admin";
}

export function canManageAddons(role: UserRole) {
  return role === "salesperson" || role === "admin" || role === "super_admin";
}

export function canSeeCompanyDashboard(role: UserRole) {
  return role === "super_admin";
}

export function roleLabel(role: UserRole) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    default:
      return "Salesperson";
  }
}
