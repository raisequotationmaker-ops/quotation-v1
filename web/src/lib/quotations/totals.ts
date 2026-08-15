/** Compute quotation total in INR from line items and selected add-ons. */
export function computeQuotationTotalInr(
  items: { unit_price: number; quantity: number }[],
  addons: { price?: number | null }[],
): number {
  const itemsTotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0,
  );
  const addonsTotal = addons.reduce(
    (sum, addon) => sum + (addon.price != null ? Number(addon.price) : 0),
    0,
  );
  return itemsTotal + addonsTotal;
}
