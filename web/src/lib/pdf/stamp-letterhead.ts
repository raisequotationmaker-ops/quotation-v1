import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { COMPANY } from "@/lib/types";

/**
 * Reserved bands for letterhead. Must match Puppeteer page.pdf margins exactly.
 * Sized so body stays inside the orange frame with clear air around chrome.
 */
export const LETTERHEAD_MARGINS = {
  topMm: 50,
  bottomMm: 30,
  sideMm: 22,
} as const;

const MM = 72 / 25.4;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `L ${x + rr} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    "Z",
  ].join(" ");
}

/**
 * Stamp letterhead onto every page — only inside the reserved margin bands.
 * Metrics from letter_head_ 1.docx (A4, #0070C0 thickThin, #E36C0A 2.25pt).
 */
export async function stampLetterheadOnPdf(
  pdfBytes: Buffer | Uint8Array,
  logoPngBytes: Buffer | Uint8Array,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes);
  const logo = await doc.embedPng(logoPngBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const blue = hexToRgb(COMPANY.borderOuter);
  const orange = hexToRgb(COMPANY.borderInner);
  const ink = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.35, 0.4, 0.45);

  const topBand = LETTERHEAD_MARGINS.topMm * MM;
  const bottomBand = LETTERHEAD_MARGINS.bottomMm * MM;

  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    const contentTop = height - topBand;
    const contentBottom = bottomBand;

    // Word letterhead: outer thickThin blue (~7pt) + inner orange 2.25pt
    const outerInset = 16;
    page.drawRectangle({
      x: outerInset,
      y: outerInset,
      width: width - outerInset * 2,
      height: height - outerInset * 2,
      borderColor: blue,
      borderWidth: 4.5,
    });
    page.drawRectangle({
      x: outerInset + 5.5,
      y: outerInset + 5.5,
      width: width - (outerInset + 5.5) * 2,
      height: height - (outerInset + 5.5) * 2,
      borderColor: blue,
      borderWidth: 1.5,
    });
    const innerInset = outerInset + 9.5;
    page.drawRectangle({
      x: innerInset,
      y: innerInset,
      width: width - innerInset * 2,
      height: height - innerInset * 2,
      borderColor: orange,
      borderWidth: 2.25,
    });

    const headerLeft = innerInset + 12;
    const headerRight = width - innerInset - 12;

    // White mask — header band
    page.drawRectangle({
      x: innerInset + 2,
      y: contentTop,
      width: width - (innerInset + 2) * 2,
      height: height - innerInset - 3 - contentTop,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    // Logo ~230×69pt aspect, fitted into header band
    const logoH = 48;
    const logoW = Math.min((logo.width / logo.height) * logoH, 168);
    const logoTop = height - innerInset - 12;
    const logoBottom = logoTop - logoH;
    page.drawImage(logo, {
      x: headerLeft,
      y: logoBottom,
      width: logoW,
      height: logoH,
    });

    const addrSize = 9;
    let addrY = logoTop - addrSize - 2;
    for (const line of COMPANY.addressLines) {
      const tw = font.widthOfTextAtSize(line, addrSize);
      page.drawText(line, {
        x: headerRight - tw,
        y: addrY,
        size: addrSize,
        font,
        color: ink,
      });
      addrY -= addrSize + 2.4;
    }

    const ruleY = Math.min(logoBottom, addrY + 2) - 7;
    const safeRuleY = Math.max(ruleY, contentTop + 8);
    page.drawLine({
      start: { x: headerLeft, y: safeRuleY },
      end: { x: headerRight, y: safeRuleY },
      thickness: 0.75,
      color: rgb(0, 0, 0),
    });

    // White mask — footer band
    page.drawRectangle({
      x: innerInset + 2,
      y: innerInset + 2,
      width: width - (innerInset + 2) * 2,
      height: contentBottom - innerInset - 2,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    const contact = `Write us : ${COMPANY.emails}, Contact : ${COMPANY.phone}`;
    const contactSize = 8;
    const boxH = 18;
    const boxW = Math.min(421, headerRight - headerLeft);
    const boxX = (width - boxW) / 2;
    const boxY = innerInset + 14;
    page.drawSvgPath(roundedRectPath(boxX, boxY, boxW, boxH, 8), {
      borderColor: rgb(0.08, 0.08, 0.08),
      borderWidth: 0.75,
      color: rgb(1, 1, 1),
    });
    const contactTw = font.widthOfTextAtSize(contact, contactSize);
    page.drawText(contact, {
      x: boxX + Math.max(4, (boxW - contactTw) / 2),
      y: boxY + (boxH - contactSize) / 2,
      size: contactSize,
      font,
      color: ink,
    });

    const pageLabel = `Page ${i + 1} of ${total}`;
    const pageSize = 7.5;
    const pageTw = font.widthOfTextAtSize(pageLabel, pageSize);
    page.drawText(pageLabel, {
      x: width - outerInset - pageTw - 2,
      y: 4,
      size: pageSize,
      font,
      color: muted,
    });
  }

  return Buffer.from(await doc.save());
}
