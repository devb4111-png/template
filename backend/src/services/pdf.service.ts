import puppeteer, { Browser } from "puppeteer-core";
import fs from "fs";
import path from "path";
import { CalculatedQuotationData } from "./calculation.service";

let cachedBrowser: Browser | null = null;

function getBrowserExecutablePath(): string {
  const envPath = process.env.EDGE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const commonPaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    "No Chromium or Edge browser executable found. Please specify EDGE_PATH in your .env file."
  );
}

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }

  const executablePath = getBrowserExecutablePath();
  cachedBrowser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=medium",
    ],
  });

  return cachedBrowser;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateQuotationHtml(data: CalculatedQuotationData): string {
  const candidatePaths = [
    path.join(__dirname, "../assets/logo.png"),
    path.join(__dirname, "../../src/assets/logo.png"),
    path.join(process.cwd(), "src/assets/logo.png"),
    path.join(process.cwd(), "dist/assets/logo.png"),
  ];

  let logoPath = "";
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      logoPath = p;
      break;
    }
  }

  let logoBase64 = "";
  if (logoPath && fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  }

  const formattedAddress = escapeHtml(data.clientAddress).replace(/\r?\n/g, "<br/>");

  const rowsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td class="col-desc">${escapeHtml(item.itemName)}</td>
      <td class="col-qty">${item.quantity}</td>
      <td class="col-price">${formatAmount(item.unitPrice)}</td>
      <td class="col-amount">${formatAmount(item.lineTotal)}</td>
    </tr>`
    )
    .join("");

  const termsHtml = data.terms
    .map((term) => `<p class="term-line">${escapeHtml(term)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quotation ${escapeHtml(data.quotationId)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111111;
      font-size: 13.5px;
      line-height: 1.45;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      width: 100%;
      margin: 0 auto;
    }

    /* Header Logo */
    .header-logo {
      margin-bottom: 8px;
    }

    .header-logo img {
      height: 52px;
      width: auto;
      display: block;
      object-fit: contain;
    }

    /* Dividers matching Canva's exact thickness */
    .thick-bar {
      width: 100%;
      height: 3.5px;
      background-color: #000000;
      margin: 12px 0 16px 0;
    }

    .section-bar {
      width: 100%;
      height: 3px;
      background-color: #000000;
      margin: 16px 0 16px 0;
    }

    /* Quotation Title */
    .quotation-title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 14px 0 20px 0;
    }

    /* Metadata Info */
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 22px;
      font-size: 13.5px;
    }

    .meta-col-left {
      text-align: left;
    }

    .meta-col-right {
      text-align: right;
    }

    .meta-label {
      color: #222222;
      font-weight: 400;
      margin-bottom: 3px;
    }

    .meta-value {
      font-weight: 500;
      color: #111111;
    }

    /* Client Info */
    .prepared-for-section {
      margin-bottom: 20px;
    }

    .prepared-for-title {
      font-size: 13.5px;
      font-weight: 400;
      margin-bottom: 4px;
      color: #222222;
    }

    .client-details {
      font-size: 13.5px;
      line-height: 1.4;
      color: #111111;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .items-table thead {
      display: table-row-group;
    }

    .items-table tr {
      page-break-inside: avoid;
    }

    .items-table th {
      padding: 10px 4px 10px 4px;
      font-size: 13.5px;
      font-weight: 700;
      color: #000000;
      border-top: 3px solid #000000;
      border-bottom: 3px solid #000000;
    }

    .items-table td {
      padding: 10px 4px;
      font-size: 13.5px;
      vertical-align: top;
      color: #111111;
    }

    .col-desc {
      width: 48%;
      text-align: left;
      padding-right: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .col-qty {
      width: 14%;
      text-align: center;
    }

    .col-price {
      width: 18%;
      text-align: right;
      padding-right: 8px;
    }

    .col-amount {
      width: 20%;
      text-align: right;
    }

    .table-footer-divider {
      width: 100%;
      height: 3px;
      background-color: #000000;
      margin: 8px 0 16px 0;
    }

    /* Totals Section */
    .totals-container {
      page-break-inside: avoid;
      display: flex;
      justify-content: space-between;
      margin: 14px 0 24px 0;
      font-size: 13.5px;
      line-height: 1.6;
    }

    .totals-labels {
      text-align: left;
    }

    .totals-values {
      text-align: right;
    }

    .grand-total-row {
      font-weight: 700;
      font-size: 14.5px;
      margin-top: 2px;
    }

    /* Terms Section */
    .terms-section {
      page-break-inside: avoid;
      margin-top: 10px;
    }

    .terms-heading {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .term-line {
      font-size: 13.5px;
      line-height: 1.5;
      margin-bottom: 6px;
      color: #222222;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Header Logo -->
    <div class="header-logo">
      ${
        logoBase64
          ? `<img src="${logoBase64}" alt="SURYA SANGAM" />`
          : `<div style="font-size: 20px; font-weight: bold; color: #166534;">SURYA SANGAM</div>`
      }
    </div>

    <!-- Divider Bar under Logo -->
    <div class="thick-bar"></div>

    <!-- Centered Document Title -->
    <div class="quotation-title">QUOTATION</div>

    <!-- Top Metadata: Quotation ID and Date -->
    <div class="meta-row">
      <div class="meta-col-left">
        <div class="meta-label">Quotation Id</div>
        <div class="meta-value">${escapeHtml(data.quotationId)}</div>
      </div>
      <div class="meta-col-right">
        <div class="meta-label">Date</div>
        <div class="meta-value">${escapeHtml(data.quotationDate)}</div>
      </div>
    </div>

    <!-- Client Details -->
    <div class="prepared-for-section">
      <div class="prepared-for-title">Prepared for</div>
      <div class="client-details">
        <strong>${escapeHtml(data.clientName)}</strong><br/>
        ${formattedAddress}<br/>
        ${escapeHtml(data.clientEmail)}
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Unit price</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="table-footer-divider"></div>

    <!-- Subtotal, GST, Grand Total -->
    <div class="totals-container">
      <div class="totals-labels">
        <div>Subtotal</div>
        <div>GST / tax</div>
        <div class="grand-total-row">Grand Total</div>
      </div>
      <div class="totals-values">
        <div>${formatAmount(data.subtotal)}</div>
        <div>${formatAmount(data.taxAmount)}</div>
        <div class="grand-total-row">${formatAmount(data.grandTotal)}</div>
      </div>
    </div>

    <!-- Terms and Conditions -->
    <div class="section-bar"></div>
    <div class="terms-section">
      <div class="terms-heading">Terms and conditions</div>
      ${termsHtml}
    </div>
  </div>
</body>
</html>`;
}

export async function generateQuotationPdf(data: CalculatedQuotationData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const html = generateQuotationHtml(data);
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}
