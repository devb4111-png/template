import puppeteer, { Browser } from "puppeteer-core";
import fs from "fs";
import path from "path";
import { CalculatedQuotationData } from "./calculation.service";
import { fillQuotationPdfTemplate } from "./pdfLibFiller.service";

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

  const company = data.companyDetails || {
    name: "Surya Sangam Renewable Energy Pvt Ltd",
    address: "Sector 62, Electronic City, Noida, UP 201309",
    phone: "+91 98765 43210",
    email: "info@suryasangam.com",
    gstin: "07AAAAA0000A1Z5",
    website: "www.suryasangam.com",
    bankName: "HDFC Bank Ltd",
    accountHolder: "Surya Sangam Renewable Energy Pvt Ltd",
    accountNumber: "50200012345678",
    ifscCode: "HDFC0001234",
    branch: "Noida Sector 62 Branch",
  };

  const formattedAddress = escapeHtml(data.clientAddress).replace(/\r?\n/g, "<br/>");

  // Dynamic pagination helper:
  // <= 6 items: single page with full header, table, totals, bank, and terms
  // 7 to 26 items: balanced across exactly 2 pages
  // > 26 items: multi-page (Page 1 up to 13, intermediate up to 18, final up to 13)
  function paginateItems(items: typeof data.items): (typeof data.items)[] {
    const total = items.length;
    if (total <= 6) {
      return [items];
    }
    const p1Count = Math.min(16, total - 4);
    if (total <= 26) {
      return [items.slice(0, p1Count), items.slice(p1Count)];
    }
    const pages: (typeof data.items)[] = [];
    const initialCount = 16;
    pages.push(items.slice(0, initialCount));
    let remaining = items.slice(initialCount);

    while (remaining.length > 0) {
      if (remaining.length <= 13) {
        pages.push(remaining);
        break;
      }
      if (remaining.length <= 26) {
        const mid = Math.ceil(remaining.length / 2);
        pages.push(remaining.slice(0, mid));
        pages.push(remaining.slice(mid));
        break;
      }
      pages.push(remaining.slice(0, 18));
      remaining = remaining.slice(18);
    }
    return pages;
  }

  // Row rendering helper
  const renderRow = (item: typeof data.items[0], isContinuation: boolean = false) => `
    <tr class="${isContinuation ? "row-cont" : "row-std"}">
      <td class="col-desc">${escapeHtml(item.itemName)}</td>
      <td class="col-qty">${item.quantity}</td>
      <td class="col-price">${formatAmount(item.unitPrice)}</td>
      <td class="col-amount">${formatAmount(item.lineTotal)}</td>
    </tr>`;

  const termsHtml = (data.terms || [])
    .map((term, idx) => `<p class="term-line">${idx + 1}. ${escapeHtml(term)}</p>`)
    .join("");

  const bankHtml = company.bankName
    ? `<div class="bank-box">
        <div class="bank-title">BANK ACCOUNT DETAILS</div>
        <div class="bank-content">
          <span><strong>Account Holder:</strong> ${escapeHtml(company.accountHolder || company.name)}</span>
          <span><strong>Bank:</strong> ${escapeHtml(company.bankName)}</span>
          <span><strong>Account No.:</strong> ${escapeHtml(company.accountNumber || "—")}</span>
          <span><strong>IFSC:</strong> ${escapeHtml(company.ifscCode || "—")}</span>
          <span><strong>Branch:</strong> ${escapeHtml(company.branch || "—")}</span>
        </div>
      </div>`
    : "";

  const renderHeader = (isContinuation: boolean = false) => `
    <div class="header-section ${isContinuation ? "header-section-cont" : ""}">
      <div class="header-logo">
        ${
          logoBase64
            ? `<img src="${logoBase64}" alt="SURYA SANGAM" class="${isContinuation ? "logo-cont" : "logo-main"}" />`
            : `<div class="logo-fallback">SURYA SANGAM</div>`
        }
      </div>
      <div class="company-header-details">
        <div class="comp-name">${escapeHtml(company.name)}</div>
        <div class="comp-sub">${escapeHtml(company.address)}</div>
        <div class="comp-sub">Phone: ${escapeHtml(company.phone)} | Email: ${escapeHtml(company.email)}</div>
        ${company.gstin ? `<div class="comp-sub">GSTIN: <strong>${escapeHtml(company.gstin)}</strong>${company.website ? ` | Web: ${escapeHtml(company.website)}` : ""}</div>` : ""}
      </div>
    </div>
    <div class="thick-bar ${isContinuation ? "thick-bar-cont" : ""}"></div>
  `;

  const renderTotals = () => `
    <div class="totals-block">
      <div class="totals-box">
        <div class="totals-row">
          <span class="tot-label">Subtotal</span>
          <span class="tot-val">${formatAmount(data.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span class="tot-label">GST / Tax (${data.taxRate}%)</span>
          <span class="tot-val">${formatAmount(data.taxAmount)}</span>
        </div>
        <div class="totals-row grand-total-row">
          <span class="tot-label">Grand Total</span>
          <span class="tot-val grand-val">INR ${formatAmount(data.grandTotal)}</span>
        </div>
      </div>
    </div>
    ${
      data.totalPayableInWords
        ? `<div class="words-line"><strong>Total Payable Amount (in words):</strong> ${escapeHtml(data.totalPayableInWords)}</div>`
        : ""
    }
  `;

  const pageChunks = paginateItems(data.items);
  const totalPages = pageChunks.length;
  let pagesHtml = "";

  if (totalPages === 1) {
    // ---------------- SINGLE PAGE MODE (<= 6 items) ----------------
    const rowsHtml = pageChunks[0].map((it) => renderRow(it, false)).join("");

    pagesHtml = `
    <div class="page page-single">
      <div class="page-top">
        ${renderHeader(false)}

        <div class="quotation-title">QUOTATION</div>

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

        <div class="prepared-for-section">
          <div class="prepared-for-title">Prepared for:</div>
          <div class="client-details">
            <div class="client-name">${escapeHtml(data.clientName)}</div>
            <div class="client-addr">${formattedAddress}</div>
            ${data.contactPerson ? `<div class="client-contact"><strong>Contact person:</strong> ${escapeHtml(data.contactPerson)}</div>` : ""}
            <div class="client-contact">
              ${data.clientPhone ? `<span><strong>Phone:</strong> ${escapeHtml(data.clientPhone)}</span> ` : ""}
              <span><strong>Email:</strong> ${escapeHtml(data.clientEmail)}</span>
            </div>
          </div>
        </div>

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
        <div class="table-bottom-bar"></div>

        ${renderTotals()}

        ${bankHtml}

        <div class="section-divider"></div>
        <div class="terms-section">
          <div class="terms-heading">Terms and conditions</div>
          ${termsHtml}
        </div>
      </div>

      <div class="page-footer">
        <div class="footer-divider"></div>
        <div class="footer-content">
          <span>${escapeHtml(company.phone)} | ${escapeHtml(company.address)} | Email: ${escapeHtml(company.email)}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>`;
  } else {
    // ---------------- MULTI PAGE MODE (> 6 items) ----------------
    pagesHtml = pageChunks
      .map((chunk, idx) => {
        const pageNum = idx + 1;
        const isFirst = pageNum === 1;
        const isLast = pageNum === totalPages;
        const rowsHtml = chunk.map((it) => renderRow(it, !isFirst)).join("");

        if (isFirst) {
          // First Page
          return `
          <!-- PAGE 1 OF ${totalPages} -->
          <div class="page">
            <div class="page-top">
              ${renderHeader(false)}

              <div class="quotation-title">QUOTATION</div>

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

              <div class="prepared-for-section">
                <div class="prepared-for-title">Prepared for:</div>
                <div class="client-details">
                  <div class="client-name">${escapeHtml(data.clientName)}</div>
                  <div class="client-addr">${formattedAddress}</div>
                  ${data.contactPerson ? `<div class="client-contact"><strong>Contact person:</strong> ${escapeHtml(data.contactPerson)}</div>` : ""}
                  <div class="client-contact">
                    ${data.clientPhone ? `<span><strong>Phone:</strong> ${escapeHtml(data.clientPhone)}</span> ` : ""}
                    <span><strong>Email:</strong> ${escapeHtml(data.clientEmail)}</span>
                  </div>
                </div>
              </div>

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
              <div class="table-bottom-bar"></div>
            </div>

            <div class="page-footer">
              <div class="footer-divider"></div>
              <div class="footer-content">
                <span>${escapeHtml(company.phone)} | ${escapeHtml(company.address)} | Email: ${escapeHtml(company.email)}</span>
                <span>Page 1 of ${totalPages}</span>
              </div>
            </div>
          </div>`;
        } else if (!isLast) {
          // Intermediate Continuation Page (no repeated table headings)
          return `
          <!-- PAGE ${pageNum} OF ${totalPages} -->
          <div class="page page-cont">
            <div class="page-top">
              <table class="items-table items-table-continuation">
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="table-bottom-bar-cont"></div>
            </div>

            <div class="page-footer">
              <div class="footer-divider"></div>
              <div class="footer-content">
                <span>${escapeHtml(company.phone)} | ${escapeHtml(company.address)} | Email: ${escapeHtml(company.email)}</span>
                <span>Page ${pageNum} of ${totalPages}</span>
              </div>
            </div>
          </div>`;
        } else {
          // Final Continuation Page (no repeated table headings)
          return `
          <!-- PAGE ${pageNum} OF ${totalPages} -->
          <div class="page page-cont">
            <div class="page-top">
              <table class="items-table items-table-continuation">
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="table-bottom-bar-cont"></div>

              ${renderTotals()}

              ${bankHtml}

              <div class="section-divider-cont"></div>
              <div class="terms-section terms-section-cont">
                <div class="terms-heading">Terms and conditions</div>
                ${termsHtml}
              </div>
            </div>

            <div class="page-footer">
              <div class="footer-divider"></div>
              <div class="footer-content">
                <span>${escapeHtml(company.phone)} | ${escapeHtml(company.address)} | Email: ${escapeHtml(company.email)}</span>
                <span>Page ${pageNum} of ${totalPages}</span>
              </div>
            </div>
          </div>`;
        }
      })
      .join("\n");
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quotation ${escapeHtml(data.quotationId)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111111;
      font-size: 12px;
      line-height: 1.35;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 10mm 15mm 9mm 15mm;
      box-sizing: border-box;
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
      overflow: hidden;
    }

    .page-cont {
      padding: 8mm 15mm 8mm 15mm;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page-top {
      width: 100%;
    }

    /* Header Section */
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .header-section-cont {
      margin-bottom: 2px;
    }

    .header-logo {
      display: flex;
      align-items: center;
    }

    .logo-main {
      height: 44px;
      width: auto;
      object-fit: contain;
    }

    .logo-cont {
      height: 34px;
      width: auto;
      object-fit: contain;
    }

    .logo-fallback {
      font-size: 18px;
      font-weight: 800;
      color: #166534;
      letter-spacing: 1px;
    }

    .company-header-details {
      text-align: right;
      font-size: 10.5px;
      line-height: 1.3;
      color: #444444;
      max-width: 320px;
    }

    .comp-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #111111;
      margin-bottom: 1px;
    }

    .comp-sub {
      color: #4b5563;
    }

    /* Dividers matching Canva style */
    .thick-bar {
      width: 100%;
      height: 3px;
      background-color: #000000;
      margin: 6px 0 10px 0;
    }

    .thick-bar-cont {
      margin: 4px 0 8px 0;
    }

    .sub-bar {
      width: 100%;
      height: 1px;
      background-color: #000000;
      margin: 4px 0 6px 0;
    }

    .section-divider {
      width: 100%;
      height: 2px;
      background-color: #000000;
      margin: 10px 0 8px 0;
    }

    .section-divider-cont {
      width: 100%;
      height: 1.5px;
      background-color: #000000;
      margin: 6px 0 5px 0;
    }

    .table-bottom-bar {
      width: 100%;
      height: 2.5px;
      background-color: #000000;
      margin: 2px 0 6px 0;
    }

    .table-bottom-bar-cont {
      width: 100%;
      height: 2px;
      background-color: #000000;
      margin: 1px 0 4px 0;
    }

    /* Document Title */
    .quotation-title {
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 6px 0 12px 0;
      color: #000000;
    }

    /* Continuation Header */
    .continuation-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      margin: 2px 0 2px 0;
    }

    .cont-left {
      font-weight: 700;
      font-size: 13px;
      color: #111111;
    }

    .cont-right {
      color: #444444;
      font-size: 11.5px;
    }

    /* Metadata Info */
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .meta-col-left {
      text-align: left;
    }

    .meta-col-right {
      text-align: right;
    }

    .meta-label {
      color: #555555;
      font-weight: 500;
      font-size: 11px;
      margin-bottom: 1px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-weight: 700;
      color: #111111;
      font-size: 13px;
    }

    /* Client Info */
    .prepared-for-section {
      margin-bottom: 12px;
      background: #fbfbfb;
      border: 1px solid #f0f0f0;
      border-left: 3px solid #166534;
      padding: 6px 10px;
      border-radius: 4px;
    }

    .prepared-for-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
      color: #166534;
    }

    .client-details {
      font-size: 12px;
      line-height: 1.35;
      color: #222222;
    }

    .client-name {
      font-weight: 700;
      font-size: 13px;
      color: #111111;
      margin-bottom: 1px;
    }

    .client-addr {
      color: #444444;
      margin-bottom: 1px;
    }

    .client-contact {
      color: #444444;
      font-size: 11.5px;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 3px;
    }

    .items-table th {
      padding: 6px 4px;
      font-size: 12px;
      font-weight: 700;
      color: #000000;
      border-top: 2.5px solid #000000;
      border-bottom: 2.5px solid #000000;
      text-transform: capitalize;
    }

    .row-std td {
      padding: 5px 4px;
      font-size: 11.5px;
      line-height: 1.3;
      vertical-align: middle;
      color: #111111;
      border-bottom: 1px solid #f2f2f2;
    }

    .row-cont td {
      padding: 3.5px 4px;
      font-size: 10.8px;
      line-height: 1.25;
      vertical-align: middle;
      color: #111111;
      border-bottom: 1px solid #f5f5f5;
    }

    .items-table-continuation {
      border-top: 2.5px solid #000000;
      margin-top: 4px;
    }

    .col-desc {
      width: 52%;
      text-align: left;
      padding-right: 8px;
      word-break: break-word;
      line-height: 1.25;
    }

    .col-qty {
      width: 10%;
      text-align: center;
    }

    .col-price {
      width: 18%;
      text-align: right;
      padding-right: 6px;
    }

    .col-amount {
      width: 20%;
      text-align: right;
      font-weight: 700;
    }

    /* Continuation Callout */
    .continuation-callout {
      text-align: right;
      font-style: italic;
      color: #666666;
      font-size: 11px;
      margin: 8px 0 12px 0;
    }

    .cont-dots {
      color: #999999;
      font-size: 9px;
    }

    /* Totals Section */
    .totals-block {
      display: flex;
      justify-content: flex-end;
      margin: 6px 0 4px 0;
    }

    .totals-box {
      width: 260px;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 6px 10px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      line-height: 1.5;
      color: #333333;
    }

    .grand-total-row {
      border-top: 1.5px solid #000000;
      margin-top: 3px;
      padding-top: 3px;
      font-size: 12.5px;
      font-weight: 700;
      color: #000000;
    }

    .grand-val {
      color: #15803d;
      font-size: 13px;
    }

    .words-line {
      text-align: right;
      font-size: 10.5px;
      color: #333333;
      margin: 2px 0 4px 0;
    }

    /* Bank Box */
    .bank-box {
      margin: 5px 0 3px 0;
      padding: 5px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 10px;
      color: #334155;
    }

    .bank-title {
      font-weight: 700;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      color: #1e293b;
      margin-bottom: 1px;
    }

    .bank-content {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Terms Section */
    .terms-section {
      margin-top: 3px;
    }

    .terms-section-cont {
      margin-top: 1px;
    }

    .terms-heading {
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 2px;
      color: #000000;
    }

    .term-line {
      font-size: 10.5px;
      line-height: 1.3;
      margin-bottom: 1px;
      color: #333333;
    }

    .term-line-italic {
      font-size: 10.5px;
      font-style: italic;
      color: #666666;
    }

    /* Footer Section */
    .page-footer {
      width: 100%;
      padding-top: 2px;
    }

    .footer-divider {
      width: 100%;
      height: 0.5px;
      background-color: #cccccc;
      margin-bottom: 4px;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #777777;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

export async function generateQuotationHtmlPdf(data: CalculatedQuotationData): Promise<Buffer> {
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
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function generateQuotationPdf(
  data: CalculatedQuotationData,
  templateId?: string
): Promise<Buffer> {
  // If explicitly requested HTML Puppeteer engine
  if (templateId === "t2-html") {
    return await generateQuotationHtmlPdf(data);
  }

  // Primary Phase 2 engine: existing PDF template filling via pdf-lib (default t2)
  return await fillQuotationPdfTemplate(data, templateId || "t2");
}
