import { COMPANY } from "@/lib/types";

/** Convert INR amount to display currency using locked INR-per-USD rate. */
export function convertAmount(
  inrAmount: number,
  currency: "INR" | "USD",
  fxRateUsed: number | null | undefined,
): number {
  if (currency === "INR") return inrAmount;
  if (!fxRateUsed || fxRateUsed <= 0) return inrAmount;
  return inrAmount / fxRateUsed;
}

export function formatMoney(
  amount: number,
  currency: "INR" | "USD",
): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function fetchFrankfurterInrPerUsd(): Promise<number> {
  const res = await fetch(
    "https://api.frankfurter.app/latest?from=INR&to=USD",
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error("FX API unavailable");
  const data = (await res.json()) as { rates?: { USD?: number } };
  const usdPerInr = data.rates?.USD;
  if (!usdPerInr || usdPerInr <= 0) throw new Error("Invalid FX payload");
  // Store as INR-per-USD
  return 1 / usdPerInr;
}

export function defaultTermsBody() {
  return (
    "Taxes: 18% GST extra applicable\n" +
    "Packaging & Forwarding: Extra As Applicable\n" +
    "Freight: To Pay / Extra as applicable\n" +
    "DELIVERY: We deliver the order in 3-4 Weeks from the date of receipt of purchase order\n" +
    "INSTALLATION: Fees extra as applicable\n" +
    "PAYMENT: 100% payment at the time of proforma invoice prior to dispatch.\n" +
    "WARRANTY: One year warranty from the date of dispatch\n" +
    "GOVERNING LAW: These Terms and Conditions and any action related hereto shall be governed, controlled, interpreted and defined by and under the laws of the State of Telangana\n" +
    "MODIFICATION: Any modification of these Terms and Conditions shall be valid only if it is in writing and signed by the authorized representatives of both Supplier and Customer."
  );
}

export { COMPANY };
