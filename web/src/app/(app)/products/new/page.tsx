import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          New product
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Add a catalog product with pricing and media.
        </p>
      </div>
      <ProductForm categories={(categories ?? []) as Category[]} />
    </div>
  );
}
