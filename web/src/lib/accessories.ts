export type StandardAccessory = {
  name: string;
  qty: number;
};

export function parseAccessories(raw: unknown): StandardAccessory[] {
  if (!Array.isArray(raw)) return [];
  const out: StandardAccessory[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) out.push({ name, qty: 1 });
      continue;
    }
    if (item && typeof item === "object" && "name" in item) {
      const name = String((item as { name?: unknown }).name ?? "").trim();
      if (!name) continue;
      const qty = Number((item as { qty?: unknown }).qty);
      out.push({ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
    }
  }
  return out;
}

export function accessoryLabel(item: StandardAccessory) {
  return item.qty > 1 ? `${item.name} × ${item.qty}` : item.name;
}
