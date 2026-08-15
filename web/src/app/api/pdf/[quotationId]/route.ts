import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuotationHtml, type PdfItem, type PdfQuotation } from "@/lib/pdf/build-html";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { stampLetterheadOnPdf } from "@/lib/pdf/stamp-letterhead";
import type { ImageLayout, Quotation, QuotationAddon, QuotationItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function loadLogoDataUrl() {
  const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
  const buf = await readFile(logoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function loadLogoPngBytes() {
  const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
  return readFile(logoPath);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ quotationId: string }> },
) {
  const { quotationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: quotation, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .maybeSingle();

  if (error || !quotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const q = quotation as Quotation & { prepared_by_email?: string | null };

  // Prefer stored PDF if present — allow ?regen=1 to force rebuild,
  // and always rebuild for ?html=1 preview
  const url = new URL(_request.url);
  const forceRegen = url.searchParams.get("regen") === "1";
  const htmlPreview = url.searchParams.get("html") === "1";

  if (q.pdf_storage_path && !forceRegen && !htmlPreview) {
    const { data: file, error: dlError } = await supabase.storage
      .from("quotation-pdfs")
      .download(q.pdf_storage_path);
    if (!dlError && file) {
      const ab = await file.arrayBuffer();
      return new NextResponse(ab, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${q.quotation_number}.pdf"`,
        },
      });
    }
  }

  const [{ data: items }, { data: addons }, dealerResult] = await Promise.all([
    supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order"),
    supabase.from("quotation_addons").select("*").eq("quotation_id", quotationId),
    q.dealer_id
      ? supabase
          .from("dealers")
          .select("dealer_name, company_name, address")
          .eq("id", q.dealer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Backfill email for older quotes that only have name/phone
  let preparedByEmail = q.prepared_by_email ?? null;
  if (!preparedByEmail && q.created_by) {
    if (q.created_by === user.id && user.email) {
      preparedByEmail = user.email;
    }
  }

  const dealer = dealerResult.data as {
    dealer_name: string;
    company_name: string | null;
    address: string | null;
  } | null;

  const pdfQuotation: PdfQuotation = {
    quotation_number: q.quotation_number,
    created_at: q.created_at,
    validity_date: q.validity_date,
    client_name: q.client_name,
    client_company: q.client_company,
    client_address: q.client_address,
    currency: q.currency,
    fx_rate_used: q.fx_rate_used,
    terms_snapshot: q.terms_snapshot,
    prepared_by_name: q.prepared_by_name,
    prepared_by_phone: q.prepared_by_phone,
    prepared_by_email: preparedByEmail,
    is_dealer_sale: q.is_dealer_sale,
    dealer_name: dealer?.dealer_name ?? null,
    dealer_company: dealer?.company_name ?? null,
    dealer_address: dealer?.address ?? null,
  };

  const addonList = (addons ?? []) as QuotationAddon[];
  const pdfItems: PdfItem[] = ((items ?? []) as QuotationItem[]).map((item) => ({
    id: item.id,
    product_name: item.product_name,
    model_no: item.model_no,
    description: item.description,
    features: item.features,
    specifications: item.specifications,
    image_url: item.image_url,
    standard_accessories: item.standard_accessories,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
    image_layout: (item.image_layout_override || "right") as ImageLayout,
    material_of_construction: item.material_of_construction,
    addons: addonList
      .filter((a) => a.quotation_item_id === item.id)
      .map((a) => ({
        addon_name: a.addon_name,
        selected_option: a.selected_option,
        price: a.price != null ? Number(a.price) : null,
      })),
  }));

  const logoDataUrl = await loadLogoDataUrl();
  const html = buildQuotationHtml(
    pdfQuotation,
    pdfItems,
    (addons ?? []) as QuotationAddon[],
    logoDataUrl,
  );

  // Dry-run HTML preview for local debugging without Chrome
  if (url.searchParams.get("html") === "1") {
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let pdfBuffer: Buffer;
  try {
    const bodyPdf = await renderHtmlToPdf(html);
    const logoBytes = await loadLogoPngBytes();
    pdfBuffer = await stampLetterheadOnPdf(bodyPdf, logoBytes);
  } catch (err) {
    console.error("PDF render failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "PDF render failed. Ensure Chrome is available locally or Chromium on Vercel.",
      },
      { status: 500 },
    );
  }

  const storagePath = `${quotationId}/${q.quotation_number}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("quotation-pdfs")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (!uploadError) {
    await supabase
      .from("quotations")
      .update({ pdf_storage_path: storagePath })
      .eq("id", quotationId);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${q.quotation_number}.pdf"`,
    },
  });
}
