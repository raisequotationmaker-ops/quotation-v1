"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeQuotationTotalInr } from "@/lib/quotations/totals";
import { allocateQuotationNumber } from "@/lib/quotations/numbering";
import { createQuotationVersion } from "@/lib/quotations/versioning";
import { convertAmount, formatMoney } from "@/lib/fx/frankfurter";
import { parseAccessories } from "@/lib/accessories";
import {
  DEFAULT_VALIDITY_DAYS,
  type AddonType,
  type Currency,
  type Dealer,
  type ImageLayout,
  type PriceTier,
  type Product,
  type ProductAddon,
  type Quotation,
  type QuotationAddon,
  type QuotationItem,
  type TermsClause,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const itemSchema = z.object({
  product_id: z.string().min(1, "Select a product"),
  price_tier: z.enum(["base", "dealer", "selling"]),
  unit_price: z.number().min(0),
  quantity: z.number().int().min(1),
  image_layout_override: z.enum(["center", "right"]),
});

type ItemAddonSel = {
  product_addon_id: string;
  name: string;
  type: AddonType;
  options: string[] | null;
  selected: boolean;
  selected_option: string | null;
  price: number | null;
};

const formSchema = z
  .object({
    client_name: z.string(),
    client_company: z.string().optional(),
    client_address: z.string().optional(),
    currency: z.enum(["INR", "USD"]),
    fx_rate_used: z.number().nullable(),
    is_dealer_sale: z.boolean(),
    dealer_id: z.string().nullable(),
    follow_up_date: z.string().nullable(),
    validity_date: z.string().nullable(),
    items: z.array(itemSchema).min(1, "Add at least one product"),
  })
  .superRefine((data, ctx) => {
    if (data.currency === "USD") {
      if (data.fx_rate_used == null || data.fx_rate_used <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fx_rate_used"],
          message: "FX rate (INR per USD) is required for USD quotations",
        });
      }
    }
    if (data.is_dealer_sale && !data.dealer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dealer_id"],
        message: "Select a dealer for dealer sales",
      });
    }
    if (!data.is_dealer_sale && !data.client_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["client_name"],
        message: "Client name is required",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export type QuotationFormInitial = Partial<
  Pick<
    Quotation,
    | "client_name"
    | "client_company"
    | "client_address"
    | "currency"
    | "fx_rate_used"
    | "is_dealer_sale"
    | "dealer_id"
    | "follow_up_date"
    | "validity_date"
  >
> & {
  items?: Pick<
    QuotationItem,
    | "product_id"
    | "price_tier"
    | "unit_price"
    | "quantity"
    | "image_layout_override"
  >[];
  selectedAddons?: (Pick<
    QuotationAddon,
    "selected_option" | "price" | "addon_name"
  > & {
    product_addon_id?: string | null;
    itemIndex?: number;
  })[];
};

function tierPrice(product: Product, tier: PriceTier): number {
  if (tier === "base") return Number(product.base_price);
  if (tier === "dealer") return Number(product.dealer_price);
  return Number(product.selling_price);
}

function defaultValidity(): string {
  return format(addDays(new Date(), DEFAULT_VALIDITY_DAYS), "yyyy-MM-dd");
}

function snapshotLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function insertItemsAndAddons(
  supabase: ReturnType<typeof createClient>,
  quotationId: string,
  itemRows: Record<string, unknown>[],
  itemAddons: ItemAddonSel[][],
) {
  const { data: insertedItems, error: itemsError } = await supabase
    .from("quotation_items")
    .insert(itemRows.map((row) => ({ ...row, quotation_id: quotationId })))
    .select("id, sort_order");
  if (itemsError) throw itemsError;
  const bySort = new Map(
    (insertedItems ?? []).map((r) => [r.sort_order as number, r.id as string]),
  );
  const addonInserts = itemAddons.flatMap((rows, index) => {
    const itemId = bySort.get(index);
    if (!itemId) return [];
    return rows
      .filter((r) => r.selected)
      .map((r) => ({
        quotation_id: quotationId,
        quotation_item_id: itemId,
        product_addon_id: r.product_addon_id,
        addon_name: r.name,
        selected_option: r.type === "radio" ? r.selected_option : null,
        price: r.price,
      }));
  });
  if (addonInserts.length) {
    const { error } = await supabase.from("quotation_addons").insert(addonInserts);
    if (error) throw error;
  }
}

function addonsForProduct(
  productId: string,
  catalog: ProductAddon[],
  selected?: QuotationFormInitial["selectedAddons"],
): ItemAddonSel[] {
  const forProduct = catalog.filter((a) => a.product_id === productId);
  const selectedMap = new Map(
    (selected ?? [])
      .filter((s) => s.product_addon_id)
      .map((s) => [s.product_addon_id as string, s]),
  );
  return forProduct.map((addon) => {
    const existing = selectedMap.get(addon.id);
    return {
      product_addon_id: addon.id,
      name: addon.name,
      type: addon.type,
      options: addon.options,
      selected: Boolean(existing),
      selected_option:
        existing?.selected_option ??
        (addon.type === "radio" ? (addon.options?.[0] ?? null) : null),
      price:
        existing?.price != null
          ? Number(existing.price)
          : addon.default_price != null
            ? Number(addon.default_price)
            : null,
    };
  });
}

export function QuotationForm({
  mode,
  sourceQuotationId,
  initial,
  products,
  productAddons = [],
  dealers,
  profile,
  termsClauses = [],
  defaultTerms,
}: {
  mode: "create" | "edit";
  sourceQuotationId?: string;
  initial?: QuotationFormInitial;
  products: Product[];
  productAddons?: ProductAddon[];
  dealers: Dealer[];
  profile: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  };
  termsClauses?: TermsClause[];
  defaultTerms: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [fxLocked, setFxLocked] = useState(
    Boolean(initial?.currency === "USD" && initial?.fx_rate_used),
  );
  const [fxFetching, setFxFetching] = useState(false);
  const [fxFetchFailed, setFxFetchFailed] = useState(false);

  const initialSnapshot = useMemo(
    () => snapshotLines(defaultTerms),
    [defaultTerms],
  );
  const libraryBodies = useMemo(
    () => new Set(termsClauses.map((c) => c.body.trim())),
    [termsClauses],
  );
  const [selectedClauseIds, setSelectedClauseIds] = useState<Set<string>>(
    () => {
      if (mode === "create" || initialSnapshot.length === 0) {
        return new Set(termsClauses.map((c) => c.id));
      }
      const snap = new Set(initialSnapshot);
      return new Set(
        termsClauses.filter((c) => snap.has(c.body.trim())).map((c) => c.id),
      );
    },
  );
  const [extraTerms, setExtraTerms] = useState<
    { body: string; selected: boolean; saveToLibrary: boolean }[]
  >(() => {
    if (mode === "create") return [];
    return initialSnapshot
      .filter((line) => !libraryBodies.has(line))
      .map((body) => ({ body, selected: true, saveToLibrary: false }));
  });
  const [newTermBody, setNewTermBody] = useState("");
  const [saveNewToLibrary, setSaveNewToLibrary] = useState(true);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const defaultItems: FormValues["items"] =
    initial?.items && initial.items.length > 0
      ? initial.items.map((item) => {
          const product = item.product_id
            ? productMap.get(item.product_id)
            : undefined;
          return {
            product_id: item.product_id ?? "",
            price_tier: item.price_tier,
            unit_price: Number(item.unit_price),
            quantity: item.quantity,
            image_layout_override:
              item.image_layout_override ??
              product?.image_layout ??
              "right",
          };
        })
      : [
          {
            product_id: "",
            price_tier: "selling" as PriceTier,
            unit_price: 0,
            quantity: 1,
            image_layout_override: "right" as ImageLayout,
          },
        ];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: initial?.client_name ?? "",
      client_company: initial?.client_company ?? "",
      client_address: initial?.client_address ?? "",
      currency: initial?.currency ?? "INR",
      fx_rate_used:
        initial?.fx_rate_used != null ? Number(initial.fx_rate_used) : null,
      is_dealer_sale: initial?.is_dealer_sale ?? false,
      dealer_id: initial?.dealer_id ?? null,
      follow_up_date: initial?.follow_up_date ?? null,
      validity_date: initial?.validity_date ?? defaultValidity(),
      items: defaultItems,
    },
  });

  const [itemAddons, setItemAddons] = useState<ItemAddonSel[][]>(() =>
    defaultItems.map((item, index) =>
      item.product_id
        ? addonsForProduct(
            item.product_id,
            productAddons,
            (initial?.selectedAddons ?? []).filter(
              (s) => s.itemIndex == null || s.itemIndex === index,
            ),
          )
        : [],
    ),
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const watchedCurrency = form.watch("currency");
  const watchedFx = form.watch("fx_rate_used");
  const isDealerSale = form.watch("is_dealer_sale");

  const selectedAddonsForTotal = itemAddons
    .flat()
    .filter((row) => row.selected)
    .map((row) => ({ price: row.price }));

  const totalInr = computeQuotationTotalInr(
    watchedItems ?? [],
    selectedAddonsForTotal,
  );

  const displayTotal = convertAmount(
    totalInr,
    watchedCurrency,
    watchedFx,
  );

  async function fetchFxRate(): Promise<number | null> {
    setFxFetching(true);
    setFxFetchFailed(false);
    try {
      const res = await fetch("/api/fx");
      const data = (await res.json()) as { inrPerUsd?: number; error?: string };
      if (!res.ok || !data.inrPerUsd || data.inrPerUsd <= 0) {
        setFxFetchFailed(true);
        toast.error(data.error || "Could not fetch FX rate — enter manually");
        return null;
      }
      form.setValue("fx_rate_used", data.inrPerUsd, { shouldValidate: true });
      setFxLocked(true);
      toast.success(`FX rate locked: ₹${data.inrPerUsd.toFixed(4)} per USD`);
      return data.inrPerUsd;
    } catch {
      setFxFetchFailed(true);
      toast.error("Could not fetch FX rate — enter manually");
      return null;
    } finally {
      setFxFetching(false);
    }
  }

  async function onCurrencyChange(next: Currency) {
    form.setValue("currency", next, { shouldValidate: true });
    if (next === "INR") {
      form.setValue("fx_rate_used", null);
      setFxLocked(false);
      setFxFetchFailed(false);
      return;
    }
    // USD: fetch and lock unless already have a locked rate from initial edit
    if (fxLocked && watchedFx && watchedFx > 0) return;
    await fetchFxRate();
  }

  function onProductChange(index: number, productId: string) {
    const product = productMap.get(productId);
    if (!product) return;
    const tier = form.getValues(`items.${index}.price_tier`) as PriceTier;
    form.setValue(`items.${index}.product_id`, productId);
    form.setValue(`items.${index}.unit_price`, tierPrice(product, tier));
    form.setValue(
      `items.${index}.image_layout_override`,
      product.image_layout ?? "right",
    );
    setItemAddons((prev) => {
      const next = [...prev];
      next[index] = addonsForProduct(productId, productAddons);
      return next;
    });
  }

  function onTierChange(index: number, tier: PriceTier) {
    form.setValue(`items.${index}.price_tier`, tier);
    const productId = form.getValues(`items.${index}.product_id`);
    const product = productMap.get(productId);
    if (product) {
      form.setValue(`items.${index}.unit_price`, tierPrice(product, tier));
    }
  }

  async function onSubmit(values: FormValues) {
    for (const row of itemAddons.flat()) {
      if (!row.selected) continue;
      if (row.type === "radio" && !row.selected_option) {
        toast.error(`Select an option for ${row.name}`);
        return;
      }
    }

    if (
      values.currency === "USD" &&
      (values.fx_rate_used == null || values.fx_rate_used <= 0)
    ) {
      toast.error("Enter a valid FX rate before saving");
      return;
    }

    for (const [index, item] of values.items.entries()) {
      const product = productMap.get(item.product_id);
      if (!product) {
        toast.error("Select a valid product for every line");
        return;
      }
      const floor = tierPrice(product, item.price_tier);
      if (item.unit_price < floor) {
        toast.error(
          `${product.name}: price cannot be below the ${item.price_tier} price (${floor})`,
        );
        form.setError(`items.${index}.unit_price`, {
          message: `Minimum ${floor}`,
        });
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const librarySelected = termsClauses
        .filter((c) => selectedClauseIds.has(c.id))
        .map((c) => c.body.trim());
      const extraSelected = extraTerms
        .filter((t) => t.selected && t.body.trim())
        .map((t) => t.body.trim());
      const draft = newTermBody.trim();
      const termsSnapshot = [
        ...librarySelected,
        ...extraSelected,
        ...(draft ? [draft] : []),
      ];
      if (termsSnapshot.length === 0) {
        throw new Error("Select at least one term and condition");
      }

      const toLibrary = [
        ...extraTerms
          .filter((t) => t.selected && t.saveToLibrary && t.body.trim())
          .map((t) => t.body.trim()),
        ...(draft && saveNewToLibrary ? [draft] : []),
      ];
      if (toLibrary.length > 0) {
        const maxSort = termsClauses.reduce(
          (m, c) => Math.max(m, c.sort_order),
          0,
        );
        const { error: termsInsertError } = await supabase
          .from("terms_clauses")
          .insert(
            toLibrary.map((body, i) => ({
              body,
              sort_order: maxSort + i + 1,
              created_by: profile.id,
              is_active: true,
            })),
          );
        if (termsInsertError) throw termsInsertError;
      }

      const termsSnapshotText = termsSnapshot.join("\n");

      const total = computeQuotationTotalInr(
        values.items,
        itemAddons.flat().filter((r) => r.selected),
      );
      const validity =
        values.validity_date && values.validity_date.trim()
          ? values.validity_date
          : defaultValidity();

      const dealer = values.is_dealer_sale
        ? dealers.find((d) => d.id === values.dealer_id)
        : null;
      const headerFields = {
        client_name: values.is_dealer_sale
          ? dealer?.dealer_name ?? dealer?.contact_person ?? "Dealer"
          : values.client_name.trim(),
        client_company: values.is_dealer_sale
          ? dealer?.company_name ?? null
          : values.client_company?.trim() || null,
        client_address: values.is_dealer_sale
          ? dealer?.address ?? null
          : values.client_address?.trim() || null,
        currency: values.currency,
        fx_rate_used:
          values.currency === "USD" ? values.fx_rate_used : null,
        is_dealer_sale: values.is_dealer_sale,
        dealer_id: values.is_dealer_sale ? values.dealer_id : null,
        follow_up_date: values.follow_up_date || null,
        validity_date: validity,
        total_amount: total,
      };

      const itemRows = values.items.map((item, index) => {
        const product = productMap.get(item.product_id);
        if (!product) {
          throw new Error("Selected product not found");
        }
        return {
          product_id: product.id,
          price_tier: item.price_tier,
          unit_price: item.unit_price,
          quantity: item.quantity,
          image_layout_override: product.image_layout ?? "right",
          sort_order: index,
          product_name: product.name,
          model_no: product.model_no,
          description: product.description,
          features: product.features ?? [],
          specifications: product.specifications ?? {},
          image_url: product.image_url,
          standard_accessories: parseAccessories(product.standard_accessories),
          material_of_construction: null,
        };
      });

      let quotationId: string;

      if (mode === "create") {
        const quotationNumber = await allocateQuotationNumber(supabase);

        const { data: inserted, error: insertError } = await supabase
          .from("quotations")
          .insert({
            quotation_number: quotationNumber,
            parent_quotation_id: null,
            version: 0,
            status: "submitted",
            created_by: profile.id,
            prepared_by_name: profile.full_name,
            prepared_by_phone: profile.phone,
            prepared_by_email: profile.email,
            terms_snapshot: termsSnapshotText,
            reminder_sent: false,
            ...headerFields,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        quotationId = inserted.id;
        await insertItemsAndAddons(supabase, quotationId, itemRows, itemAddons);

        toast.success(`Quotation ${quotationNumber} created`);
      } else {
        if (!sourceQuotationId) {
          throw new Error("Missing source quotation for edit");
        }
        quotationId = await createQuotationVersion(supabase, sourceQuotationId);

        const { error: updateError } = await supabase
          .from("quotations")
          .update({ ...headerFields, terms_snapshot: termsSnapshotText })
          .eq("id", quotationId);
        if (updateError) throw updateError;

        const { error: delAddonsError } = await supabase
          .from("quotation_addons")
          .delete()
          .eq("quotation_id", quotationId);
        if (delAddonsError) throw delAddonsError;

        const { error: delItemsError } = await supabase
          .from("quotation_items")
          .delete()
          .eq("quotation_id", quotationId);
        if (delItemsError) throw delItemsError;

        await insertItemsAndAddons(supabase, quotationId, itemRows, itemAddons);

        toast.success("New quotation version created");
      }

      router.push(`/quotations/${quotationId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client &amp; header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_name">Client name</Label>
            <Input
              id="client_name"
              {...form.register("client_name")}
              disabled={isDealerSale}
              aria-invalid={!!form.formState.errors.client_name}
            />
            {form.formState.errors.client_name ? (
              <p className="text-xs text-red-600">
                {form.formState.errors.client_name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_company">Client company</Label>
            <Input
              id="client_company"
              {...form.register("client_company")}
              disabled={isDealerSale}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="client_address">Client address</Label>
            <Textarea
              id="client_address"
              rows={3}
              {...form.register("client_address")}
              disabled={isDealerSale}
              placeholder="Street, city, PIN"
            />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    if (v === "INR" || v === "USD") onCurrencyChange(v);
                  }}
                  items={{ INR: "INR", USD: "USD" }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {watchedCurrency === "USD" ? (
            <div className="space-y-2">
              <Label htmlFor="fx_rate_used">
                FX rate (INR per USD)
                {fxLocked ? " — locked" : ""}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="fx_rate_used"
                  type="number"
                  step="0.0001"
                  min="0"
                  disabled={fxLocked && !fxFetchFailed}
                  {...form.register("fx_rate_used", {
                    setValueAs: (v) =>
                      v === "" || v == null ? null : Number(v),
                  })}
                />
                {!fxLocked || fxFetchFailed ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={fxFetching}
                    onClick={() => fetchFxRate()}
                  >
                    {fxFetching ? "Fetching…" : "Fetch rate"}
                  </Button>
                ) : null}
              </div>
              {fxFetchFailed ? (
                <p className="text-xs text-amber-700">
                  Live rate unavailable. Enter the INR-per-USD rate manually.
                </p>
              ) : null}
              {form.formState.errors.fx_rate_used ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.fx_rate_used.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2">
            <div>
              <Label htmlFor="is_dealer_sale">Dealer sale</Label>
              <p className="text-xs text-slate-500">
                Link this quotation to a registered dealer.
              </p>
            </div>
            <Controller
              control={form.control}
              name="is_dealer_sale"
              render={({ field }) => (
                <Switch
                  id="is_dealer_sale"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue("client_name", "");
                      form.setValue("client_company", "");
                      form.setValue("client_address", "");
                    } else {
                      form.setValue("dealer_id", null);
                    }
                  }}
                />
              )}
            />
          </div>

          {isDealerSale ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Dealer</Label>
              <Controller
                control={form.control}
                name="dealer_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || null)}
                    items={dealers.map((d) => ({
                      value: d.id,
                      label: d.company_name
                        ? `${d.dealer_name} — ${d.company_name}`
                        : d.dealer_name,
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.dealer_name}
                          {d.company_name ? ` — ${d.company_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.dealer_id ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.dealer_id.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="follow_up_date">Follow-up date</Label>
            <Input
              id="follow_up_date"
              type="date"
              {...form.register("follow_up_date", {
                setValueAs: (v) => (v === "" ? null : v),
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validity_date">Validity date</Label>
            <Input
              id="validity_date"
              type="date"
              {...form.register("validity_date", {
                setValueAs: (v) => (v === "" ? null : v),
              })}
            />
            <p className="text-xs text-slate-500">
              Defaults to today + {DEFAULT_VALIDITY_DAYS} days if left empty.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Products</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              append({
                product_id: "",
                price_tier: "selling",
                unit_price: 0,
                quantity: 1,
                image_layout_override: "right",
              });
              setItemAddons((prev) => [...prev, []]);
            }}
          >
            <Plus className="size-3.5" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const lineProduct = productMap.get(
              form.watch(`items.${index}.product_id`),
            );
            const minPrice = lineProduct
              ? tierPrice(lineProduct, form.watch(`items.${index}.price_tier`))
              : 0;
            return (
            <div
              key={field.id}
              className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className="space-y-2 lg:col-span-2">
                <Label>Product</Label>
                <Controller
                  control={form.control}
                  name={`items.${index}.product_id`}
                  render={({ field: f }) => (
                    <Select
                      value={f.value || ""}
                      onValueChange={(v) => {
                        if (v) onProductChange(index, v);
                      }}
                      items={products.map((p) => ({
                        value: p.id,
                        label: p.model_no
                          ? `${p.name} (${p.model_no})`
                          : p.name,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.model_no ? ` (${p.model_no})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Price tier</Label>
                <Controller
                  control={form.control}
                  name={`items.${index}.price_tier`}
                  render={({ field: f }) => (
                    <Select
                      value={f.value}
                      onValueChange={(v) => {
                        if (v === "base" || v === "dealer" || v === "selling") {
                          onTierChange(index, v);
                        }
                      }}
                      items={{
                        base: "Base",
                        dealer: "Dealer",
                        selling: "Selling",
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="selling">Selling</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Unit price (INR)</Label>
                <Input
                  type="number"
                  min={minPrice}
                  step="0.01"
                  {...form.register(`items.${index}.unit_price`, {
                    valueAsNumber: true,
                  })}
                />
                {form.formState.errors.items?.[index]?.unit_price ? (
                  <p className="text-xs text-rose-600">
                    {form.formState.errors.items[index]?.unit_price?.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Qty</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    {...form.register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => {
                      remove(index);
                      setItemAddons((prev) =>
                        prev.filter((_, i) => i !== index),
                      );
                    }}
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {(itemAddons[index] ?? []).length > 0 ? (
                <div className="space-y-2 lg:col-span-6">
                  <p className="text-sm font-medium text-slate-700">
                    Add-ons for this product
                  </p>
                  {itemAddons[index].map((addon, addonIndex) => (
                    <div
                      key={addon.product_addon_id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                    >
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={addon.selected}
                          onCheckedChange={(checked) => {
                            setItemAddons((prev) => {
                              const next = prev.map((rows) => [...rows]);
                              next[index][addonIndex] = {
                                ...next[index][addonIndex],
                                selected: Boolean(checked),
                              };
                              return next;
                            });
                          }}
                        />
                        <span>{addon.name}</span>
                      </label>
                      {addon.selected ? (
                        <div className="flex flex-wrap gap-2">
                          {addon.type === "radio" && addon.options?.length ? (
                            <Select
                              value={addon.selected_option ?? ""}
                              onValueChange={(v) => {
                                setItemAddons((prev) => {
                                  const next = prev.map((rows) => [...rows]);
                                  next[index][addonIndex] = {
                                    ...next[index][addonIndex],
                                    selected_option: v || null,
                                  };
                                  return next;
                                });
                              }}
                              items={Object.fromEntries(
                                addon.options.map((o) => [o, o]),
                              )}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Option" />
                              </SelectTrigger>
                              <SelectContent>
                                {addon.options.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-28"
                            value={addon.price ?? ""}
                            onChange={(e) => {
                              const value =
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value);
                              setItemAddons((prev) => {
                                const next = prev.map((rows) => [...rows]);
                                next[index][addonIndex] = {
                                  ...next[index][addonIndex],
                                  price: value,
                                };
                                return next;
                              });
                            }}
                            placeholder="Price"
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            );
          })}
          {form.formState.errors.items?.root ? (
            <p className="text-xs text-red-600">
              {form.formState.errors.items.root.message}
            </p>
          ) : form.formState.errors.items?.message ? (
            <p className="text-xs text-red-600">
              {form.formState.errors.items.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms &amp; conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Tick the clauses to include on this quotation. You can also add a
            new term and optionally save it to the library.
          </p>
          <div className="space-y-2">
            {termsClauses.map((clause) => {
              const checked = selectedClauseIds.has(clause.id);
              return (
                <label
                  key={clause.id}
                  className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    onCheckedChange={(value) => {
                      setSelectedClauseIds((prev) => {
                        const next = new Set(prev);
                        if (value) next.add(clause.id);
                        else next.delete(clause.id);
                        return next;
                      });
                    }}
                  />
                  <span>{clause.body}</span>
                </label>
              );
            })}
            {extraTerms.map((term, index) => (
              <label
                key={`extra-${index}`}
                className="flex items-start gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={term.selected}
                  onCheckedChange={(value) => {
                    setExtraTerms((prev) =>
                      prev.map((t, i) =>
                        i === index ? { ...t, selected: Boolean(value) } : t,
                      ),
                    );
                  }}
                />
                <span>{term.body}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <Label htmlFor="new-term">Add new term</Label>
            <Input
              id="new-term"
              value={newTermBody}
              onChange={(e) => setNewTermBody(e.target.value)}
              placeholder="e.g. Validity of offer: 30 days from the date of quotation"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={saveNewToLibrary}
                onCheckedChange={(value) => setSaveNewToLibrary(Boolean(value))}
              />
              Save to library for future quotations
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {formatMoney(displayTotal, watchedCurrency)}
            </p>
            {watchedCurrency === "USD" ? (
              <p className="text-xs text-slate-500">
                Underlying INR:{" "}
                {formatMoney(totalInr, "INR")}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create quotation"
                  : "Save as new version"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
