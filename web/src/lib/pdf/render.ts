import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { LETTERHEAD_MARGINS } from "@/lib/pdf/stamp-letterhead";

/**
 * Render body HTML to PDF. Margins reserve space for letterhead stamped
 * on every page afterwards — keep in sync with LETTERHEAD_MARGINS.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const isDev = process.env.NODE_ENV === "development";

  const executablePath = isDev
    ? process.env.PUPPETEER_EXECUTABLE_PATH ||
      (process.platform === "win32"
        ? "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"
        : process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : "/usr/bin/google-chrome")
    : await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: isDev ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const { topMm, bottomMm, sideMm } = LETTERHEAD_MARGINS;
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: `${topMm}mm`,
        bottom: `${bottomMm}mm`,
        left: `${sideMm}mm`,
        right: `${sideMm}mm`,
      },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
