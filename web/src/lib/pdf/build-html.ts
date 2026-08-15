import { COMPANY, type Currency, type ImageLayout } from "@/lib/types";
import { convertAmount, formatMoney } from "@/lib/fx/frankfurter";
import { parseAccessories } from "@/lib/accessories";

export type PdfItem = {
  product_name: string | null;
  model_no: string | null;
  description: string | null;
  features: string[] | null;
  specifications: Record<string, string> | null;
  image_url: string | null;
  standard_accessories: unknown;
  quantity: number;
  unit_price: number;
  image_layout: ImageLayout;
  material_of_construction?: string | null;
  id?: string;
  addons?: PdfAddon[];
};

export type PdfAddon = {
  addon_name: string | null;
  selected_option: string | null;
  price: number | null;
};

export type PdfQuotation = {
  quotation_number: string;
  created_at: string;
  validity_date: string | null;
  client_name: string | null;
  client_company: string | null;
  client_address?: string | null;
  currency: Currency;
  fx_rate_used: number | null;
  terms_snapshot: string | null;
  prepared_by_name: string | null;
  prepared_by_phone: string | null;
  prepared_by_email: string | null;
  is_dealer_sale?: boolean;
  dealer_name?: string | null;
  dealer_company?: string | null;
  dealer_address?: string | null;
};

function esc(s: string | null | undefined) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function money(inr: number, currency: Currency, fx: number | null) {
  return formatMoney(convertAmount(inr, currency, fx), currency);
}

function bullets(items: string[] | null | undefined) {
  if (!items?.length) return "";
  return `<ul class="bullets">${items.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
}

function specsTable(specs: Record<string, string> | null | undefined) {
  if (!specs || !Object.keys(specs).length) return "";
  const rows = Object.entries(specs)
    .map(
      ([k, v]) =>
        `<tr><td class="spec-k">${esc(k)}</td><td class="spec-v">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table class="specs"><thead><tr><th>Specification</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function productBlock(item: PdfItem, currency: Currency, fx: number | null, sno: number) {
  const layout = item.image_layout || "right";
  const title = item.model_no
    ? `${item.product_name ?? ""} (Model: ${item.model_no})`
    : (item.product_name ?? "Product");

  const imageHtml = item.image_url
    ? `<img class="product-img" src="${esc(item.image_url)}" alt="" />`
    : "";

  const productHeading = `<h3 class="product-title">For ${esc(title)}</h3>`;
  const continued = `<p class="product-cont">For ${esc(title)}</p>`;
  const hasFeatures = Boolean(item.features?.length);
  const hasSpecs = Boolean(
    item.specifications && Object.keys(item.specifications).length,
  );

  const description = `
    <p class="label">Description:</p>
    <p class="body">${esc(item.description)}</p>
  `;

  let leadHtml: string;
  if (layout === "center") {
    leadHtml = `
      <div class="keep lead">
        ${productHeading}
        ${description}
        ${imageHtml ? `<div class="img-center">${imageHtml}</div>` : ""}
      </div>
    `;
  } else if (imageHtml) {
    leadHtml = `
      <div class="keep lead">
        ${productHeading}
        <div class="split">
          <div class="split-text">${description}</div>
          <div class="split-img">${imageHtml}</div>
        </div>
      </div>
    `;
  } else {
    leadHtml = `
      <div class="keep lead">
        ${productHeading}
        ${description}
      </div>
    `;
  }

  const featuresHtml = hasFeatures
    ? `<div class="keep features-block">
        ${continued}
        <p class="label">FEATURES:</p>
        ${bullets(item.features)}
      </div>`
    : "";

  const specsHtml = hasSpecs
    ? `<div class="keep specs-block">
        ${hasFeatures ? "" : continued}
        <p class="label">Specifications:</p>
        ${specsTable(item.specifications)}
      </div>`
    : "";

  const accessoryRows = parseAccessories(item.standard_accessories)
    .map(
      (a, i) => `
      <tr>
        <td>${String(sno).padStart(2, "0")}.${i + 1}</td>
        <td>${esc(a.name)}</td>
        <td>${a.qty}</td>
        <td>—</td>
      </tr>`,
    )
    .join("");
  const accessoryCount = parseAccessories(item.standard_accessories).length;

  const pricedAddons = (item.addons ?? []).filter((a) => (a.price ?? 0) > 0);
  const addonRows = pricedAddons
    .map(
      (a, i) => `
      <tr>
        <td>${String(sno).padStart(2, "0")}.${accessoryCount + i + 1}</td>
        <td>${esc(a.addon_name)}${a.selected_option ? ` (${esc(a.selected_option)})` : ""}</td>
        <td>1</td>
        <td>${esc(money(a.price ?? 0, currency, fx))}</td>
      </tr>`,
    )
    .join("");

  const commercial = `
    <div class="keep table-block">
      ${hasFeatures || hasSpecs ? "" : continued}
      <p class="label">Commercial Offer:</p>
      <table class="commercial">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Price (${esc(currency)})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${String(sno).padStart(2, "0")}</td>
            <td><strong>${esc(title)}</strong></td>
            <td>${item.quantity}</td>
            <td>${esc(money(item.unit_price * item.quantity, currency, fx))}</td>
          </tr>
          ${accessoryRows}
          ${addonRows}
        </tbody>
      </table>
    </div>
  `;

  return `
    <section class="product-block">
      ${leadHtml}
      ${featuresHtml}
      ${specsHtml}
      ${commercial}
    </section>
  `;
}

/**
 * Body-only HTML. Do NOT set @page margins here — Puppeteer margins
 * reserve space for letterhead stamped on every page.
 */
export function buildQuotationHtml(
  quotation: PdfQuotation,
  items: PdfItem[],
  addons: PdfAddon[],
  _logoDataUrl: string,
): string {
  const currency = quotation.currency;
  const fx = quotation.fx_rate_used;
  void addons;

  const productHtml = items
    .map((item, i) => productBlock(item, currency, fx, i + 1))
    .join("");

  const termsLines = (quotation.terms_snapshot || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");

  const toName = quotation.is_dealer_sale
    ? quotation.dealer_name || quotation.client_name
    : quotation.client_name;
  const toCompany = quotation.is_dealer_sale
    ? quotation.dealer_company || quotation.client_company
    : quotation.client_company;
  const toAddress = quotation.is_dealer_sale
    ? quotation.dealer_address || quotation.client_address
    : quotation.client_address;

  const preparedName = quotation.prepared_by_name || "";
  const preparedEmail = quotation.prepared_by_email || "";
  const preparedPhone = quotation.prepared_by_phone || "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    margin: 0;
    padding: 0;
    line-height: 1.45;
    background: #fff;
  }
  .offer-title {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    margin: 0 0 4px;
    color: #0f172a;
  }
  .meta-box {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
    margin: 10px 0 16px;
  }
  .meta-box > tbody > tr > td {
    width: 50%;
    border: none;
    border-right: 1px solid #000;
    vertical-align: top;
    padding: 10px 12px;
  }
  .meta-box > tbody > tr > td:last-child { border-right: none; }
  .to-label { font-weight: 700; margin: 0 0 8px; }
  .to-name, .to-company { font-weight: 700; margin: 0; line-height: 1.4; }
  .to-company { text-transform: uppercase; }
  .to-address { font-weight: 400; margin: 4px 0 0; white-space: pre-line; line-height: 1.4; }
  .meta-kv { border-collapse: collapse; }
  .meta-kv td { border: none; padding: 3px 0; vertical-align: baseline; }
  .meta-kv .k { font-weight: 700; white-space: nowrap; padding-right: 8px; }
  .meta-kv .v { font-weight: 400; }
  .product-title {
    margin: 0 0 8px;
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
  }
  .product-cont {
    margin: 0 0 4px;
    font-size: 10pt;
    font-weight: 700;
    color: #334155;
  }
  .label { font-weight: 700; margin: 8px 0 4px; }
  .body { margin: 0 0 8px; white-space: pre-wrap; }
  .bullets { margin: 0 0 8px 16px; padding: 0; }
  .bullets li { margin: 2px 0; }
  .split {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 14px;
    align-items: start;
  }
  .split-img { text-align: center; padding-top: 4px; }
  .img-center { text-align: center; margin: 10px 0 12px; }
  .product-img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
    background: transparent;
  }
  .split-img .product-img { max-height: 230px; }
  .specs { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .specs th, .specs td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
  .specs th { background: #e2e8f0; text-align: left; }
  .spec-k { width: 28%; font-weight: 600; background: #f1f5f9; }
  .commercial { width: 100%; border-collapse: collapse; margin: 4px 0 0; }
  .commercial th, .commercial td {
    border: 1px solid #64748b;
    padding: 6px;
    vertical-align: top;
  }
  .commercial th { background: #e2e8f0; text-align: left; }
  .commercial thead { display: table-header-group; }
  .commercial tr, .specs tr { break-inside: avoid; page-break-inside: avoid; }
  .product-block { margin-bottom: 18px; }
  .keep {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .table-block { margin: 10px 0 14px; }
  .terms { break-inside: avoid; page-break-inside: avoid; }
  .terms ul { margin: 0 0 0 16px; padding: 0; }
  .sign {
    margin-top: 32px;
    text-align: right;
    page-break-inside: avoid;
  }
  .sign .from { font-weight: 700; margin: 0 0 4px; }
  .sign .name { font-weight: 700; margin: 0 0 2px; text-transform: uppercase; }
  .sign p { margin: 2px 0; }
</style>
</head>
<body>
  <h1 class="offer-title">Technical and Commercial Offer</h1>

  <table class="meta-box">
    <tr>
      <td>
        <p class="to-label">To</p>
        ${toName ? `<p class="to-name">${esc(toName)}</p>` : ""}
        ${toCompany ? `<p class="to-company">${esc(toCompany)}</p>` : ""}
        ${toAddress ? `<p class="to-address">${esc(toAddress)}</p>` : ""}
      </td>
      <td>
        <table class="meta-kv">
          <tr><td class="k">Quote No :</td><td class="v">${esc(quotation.quotation_number)}</td></tr>
          <tr><td class="k">Date :</td><td class="v">${esc(fmtDate(quotation.created_at))}</td></tr>
          <tr><td class="k">Validity :</td><td class="v">${esc(fmtDate(quotation.validity_date))}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  ${productHtml}

  <section class="terms">
    <p class="label">Terms And Conditions:</p>
    <ul>${termsLines}</ul>
  </section>

  <div class="sign">
    <p class="from">From ${esc(COMPANY.name)}</p>
    ${preparedName ? `<p class="name">${esc(preparedName)}</p>` : ""}
    ${preparedEmail ? `<p>${esc(preparedEmail)}</p>` : ""}
    ${preparedPhone ? `<p>Contact: ${esc(preparedPhone)}</p>` : ""}
  </div>
</body>
</html>`;
}
