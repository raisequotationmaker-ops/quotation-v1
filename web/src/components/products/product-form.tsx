"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageFile } from "@/lib/images/resize";
import { parseAccessories } from "@/lib/accessories";
import type {
  AddonType,
  Category,
  ImageLayout,
  Product,
  ProductAddon,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SpecRow = { key: string; value: string };

type AddonDraft = {
  id?: string;
  name: string;
  type: AddonType;
  optionsText: string;
  default_price: string;
};

function specsToRows(specs: Record<string, string> | null | undefined): SpecRow[] {
  const entries = Object.entries(specs ?? {});
  if (entries.length === 0) return [{ key: "", value: "" }];
  return entries.map(([key, value]) => ({ key, value }));
}

function rowsToSpecs(rows: SpecRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    out[k] = row.value.trim();
  }
  return out;
}

export function ProductForm({
  product,
  categories: initialCategories,
  productAddons = [],
}: {
  product?: Product;
  categories: Category[];
  productAddons?: ProductAddon[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState(product?.name ?? "");
  const [modelNo, setModelNo] = useState(product?.model_no ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    product?.category_id ?? null,
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [addonDrafts, setAddonDrafts] = useState<AddonDraft[]>(() =>
    productAddons.length
      ? productAddons.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          optionsText: (a.options ?? []).join(", "),
          default_price:
            a.default_price != null ? String(a.default_price) : "",
        }))
      : [],
  );
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""));
  const [dealerPrice, setDealerPrice] = useState(
    String(product?.dealer_price ?? ""),
  );
  const [sellingPrice, setSellingPrice] = useState(
    String(product?.selling_price ?? ""),
  );
  const [features, setFeatures] = useState<string[]>(
    product?.features?.length ? product.features : [""],
  );
  const [specRows, setSpecRows] = useState<SpecRow[]>(
    specsToRows(product?.specifications),
  );
  const [accessories, setAccessories] = useState(() => {
    const parsed = parseAccessories(product?.standard_accessories);
    return parsed.length
      ? parsed.map((a) => ({ name: a.name, qty: String(a.qty) }))
      : [{ name: "", qty: "1" }];
  });
  const [imageLayout, setImageLayout] = useState<ImageLayout>(
    product?.image_layout ?? "right",
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  const previewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return imageUrl || null;
  }, [imageFile, imageUrl]);

  async function addCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: newCatName.trim(), created_by: user?.id ?? null })
      .select("*")
      .single();
    setAddingCat(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const cat = data as Category;
    setCategories((prev) =>
      [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCategoryId(cat.id);
    setNewCatName("");
    setCatDialogOpen(false);
    toast.success("Category added");
  }

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    const optimized = await resizeImageFile(file, 1200);
    const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, optimized, { upsert: false, contentType: optimized.type });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let nextImageUrl = imageUrl || null;
      if (imageFile) {
        nextImageUrl = await uploadImage(imageFile);
      }

      const payload = {
        name: name.trim(),
        model_no: modelNo.trim() || null,
        category_id: categoryId,
        description: description.trim() || null,
        base_price: Number(basePrice),
        dealer_price: Number(dealerPrice),
        selling_price: Number(sellingPrice),
        features: features.map((f) => f.trim()).filter(Boolean),
        specifications: rowsToSpecs(specRows),
        standard_accessories: accessories
          .map((a) => ({
            name: a.name.trim(),
            qty: Math.max(1, Number(a.qty) || 1),
          }))
          .filter((a) => a.name),
        image_url: nextImageUrl,
        image_layout: imageLayout,
        material_of_construction: null,
        is_active: isActive,
        created_by: product?.created_by ?? user?.id ?? null,
      };

      let productId = product?.id;
      if (product) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        productId = inserted.id;
      }

      if (productId) {
        await supabase.from("product_addons").delete().eq("product_id", productId);
        const addonRows = addonDrafts
          .map((a, i) => ({
            product_id: productId as string,
            name: a.name.trim(),
            type: a.type,
            options:
              a.type === "radio"
                ? a.optionsText
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                : null,
            default_price:
              a.default_price === "" ? null : Number(a.default_price),
            sort_order: i,
          }))
          .filter((a) => a.name);
        if (addonRows.length) {
          const { error: addonError } = await supabase
            .from("product_addons")
            .insert(addonRows);
          if (addonError) throw addonError;
        }
      }

      toast.success(product ? "Product updated" : "Product created");
      router.push("/products");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model_no">Model no</Label>
            <Input
              id="model_no"
              value={modelNo}
              onChange={(e) => setModelNo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2">
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v)}
                items={categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              >
                <SelectTrigger className="w-full flex-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                <DialogTrigger render={<Button type="button" variant="outline" />}>
                  <Plus className="size-4" />
                  Add
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New category</DialogTitle>
                    <DialogDescription>
                      Create a category and select it for this product.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="new-cat">Name</Label>
                    <Input
                      id="new-cat"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={addCategory}
                      disabled={addingCat}
                    >
                      {addingCat ? "Saving…" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing (INR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="base_price">Base price</Label>
            <Input
              id="base_price"
              type="number"
              min="0"
              step="0.01"
              required
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dealer_price">Dealer price</Label>
            <Input
              id="dealer_price"
              type="number"
              min="0"
              step="0.01"
              required
              value={dealerPrice}
              onChange={(e) => setDealerPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="selling_price">Selling price</Label>
            <Input
              id="selling_price"
              type="number"
              min="0"
              step="0.01"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={f}
                onChange={(e) => {
                  const next = [...features];
                  next[i] = e.target.value;
                  setFeatures(next);
                }}
                placeholder={`Feature ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setFeatures((prev) =>
                    prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFeatures((prev) => [...prev, ""])}
          >
            <Plus className="size-3.5" />
            Add feature
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {specRows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={row.key}
                onChange={(e) => {
                  const next = [...specRows];
                  next[i] = { ...next[i], key: e.target.value };
                  setSpecRows(next);
                }}
                placeholder="Key"
              />
              <Input
                value={row.value}
                onChange={(e) => {
                  const next = [...specRows];
                  next[i] = { ...next[i], value: e.target.value };
                  setSpecRows(next);
                }}
                placeholder="Value"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setSpecRows((prev) =>
                    prev.length === 1
                      ? [{ key: "", value: "" }]
                      : prev.filter((_, idx) => idx !== i),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSpecRows((prev) => [...prev, { key: "", value: "" }])
            }
          >
            <Plus className="size-3.5" />
            Add row
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standard accessories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-600">
            Included with the product (no extra price). Add material of construction
            here as a line, with quantity. These print on the commercial table.
          </p>
          {accessories.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_88px_auto] gap-2">
              <Input
                value={a.name}
                onChange={(e) => {
                  const next = [...accessories];
                  next[i] = { ...next[i], name: e.target.value };
                  setAccessories(next);
                }}
                placeholder="e.g. MOC — SS 316 / baskets"
              />
              <Input
                type="number"
                min="1"
                step="1"
                value={a.qty}
                onChange={(e) => {
                  const next = [...accessories];
                  next[i] = { ...next[i], qty: e.target.value };
                  setAccessories(next);
                }}
                aria-label="Quantity"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setAccessories((prev) =>
                    prev.length === 1
                      ? [{ name: "", qty: "1" }]
                      : prev.filter((_, idx) => idx !== i),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setAccessories((prev) => [...prev, { name: "", qty: "1" }])
            }
          >
            <Plus className="size-3.5" />
            Add accessory
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Product add-ons</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setAddonDrafts((prev) => [
                ...prev,
                {
                  name: "",
                  type: "checkbox",
                  optionsText: "",
                  default_price: "",
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Add add-on
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addonDrafts.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add optional extras that can be ticked per product on a quotation.
            </p>
          ) : (
            addonDrafts.map((addon, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={addon.name}
                    onChange={(e) => {
                      const next = [...addonDrafts];
                      next[i] = { ...next[i], name: e.target.value };
                      setAddonDrafts(next);
                    }}
                    placeholder="e.g. IQ/OQ documentation"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={addon.type}
                    onValueChange={(v) => {
                      if (v !== "checkbox" && v !== "radio") return;
                      const next = [...addonDrafts];
                      next[i] = { ...next[i], type: v };
                      setAddonDrafts(next);
                    }}
                    items={{ checkbox: "Checkbox", radio: "Radio" }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="radio">Radio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addon.type === "radio" ? (
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Options (comma separated)</Label>
                    <Input
                      value={addon.optionsText}
                      onChange={(e) => {
                        const next = [...addonDrafts];
                        next[i] = { ...next[i], optionsText: e.target.value };
                        setAddonDrafts(next);
                      }}
                    />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label>Default price (INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addon.default_price}
                    onChange={(e) => {
                      const next = [...addonDrafts];
                      next[i] = { ...next[i], default_price: e.target.value };
                      setAddonDrafts(next);
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setAddonDrafts((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image & status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="image">Product image</Label>
            <Input
              id="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Product preview"
                className="mt-2 max-h-48 rounded-lg border border-slate-200 object-contain"
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Image layout</Label>
            <Select
              value={imageLayout}
              onValueChange={(v) => setImageLayout(v as ImageLayout)}
              items={{ center: "Center", right: "Right" }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <Label htmlFor="is_active">Active</Label>
              <p className="text-xs text-slate-500">Inactive products stay in history but are hidden from new quotes.</p>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : product ? "Update product" : "Create product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
