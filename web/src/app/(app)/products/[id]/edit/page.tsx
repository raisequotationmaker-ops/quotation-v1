import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, ProductAddon } from "@/lib/types";
import { ProductForm } from "@/components/products/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: productAddons }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("product_addons")
        .select("*")
        .eq("product_id", id)
        .order("sort_order"),
    ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Edit product
        </h1>
        <p className="mt-1 text-sm text-slate-600">{product.name}</p>
      </div>
      <ProductForm
        product={product as Product}
        categories={(categories ?? []) as Category[]}
        productAddons={(productAddons ?? []) as ProductAddon[]}
      />
    </div>
  );
}
