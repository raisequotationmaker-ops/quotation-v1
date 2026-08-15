import { createClient } from "@/lib/supabase/server";
import { canManageCategories } from "@/lib/auth/roles";
import type { Category } from "@/lib/types";
import { CategoriesManager } from "@/components/categories/categories-manager";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Categories
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Product categories used when creating products.
        </p>
      </div>
      <CategoriesManager
        initialCategories={(categories ?? []) as Category[]}
        canWrite={canManageCategories(profile!.role)}
      />
    </div>
  );
}
