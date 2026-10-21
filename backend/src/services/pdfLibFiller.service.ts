import fs from "fs";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { CalculatedQuotationData, roundToTwoDecimals } from "./calculation.service";
import {
  resolveTemplateConfig,
  TemplateDefinition,
  FieldPlacement,
  TableColumnDef,
  RectCover,
} from "../config/pdfMap.config";

function formatAmount(amount: number): string {
  if (isNaN(amount) || amount === undefined || amount === null) return "0.00";
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Sanitizes strings for standard PDF WinAnsi font encoding (Helvetica).
 * Replaces newlines, smart quotes, em-dashes, bullets, rupee symbols, etc.
 */
function cleanWinAnsi(text?: string | null): string {
  if (!text && text !== "0") return "";
  return String(text)
    .replace(/\r?\n+/g, ", ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u20B9/g, "INR ")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extracts clean term value without redundant prefixes like "Quotation validity: "
 */
function getCleanTerm(term?: string, fallback: string = ""): string {
  if (!term) return fallback;
  const cleaned = cleanWinAnsi(term);
  if (cleaned.includes(":")) {
    const after = cleaned.split(":").slice(1).join(":").trim();
    if (after.length > 2) return after;
  }
  return cleaned;
}

/**
 * Splits text into lines that fit within maxWidth
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          // Word longer than maxWidth: break characters
          let chunk = "";
          for (let i = 0; i < word.length; i++) {
            const charCandidate = chunk + word[i];
            if (font.widthOfTextAtSize(charCandidate, fontSize) > maxWidth) {
              if (chunk) resultLines.push(chunk);
              chunk = word[i];
            } else {
              chunk = charCandidate;
            }
          }
          currentLine = chunk;
        }
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

/**
 * Draws a clean rectangle to cover underlying template text/placeholders
 */
function drawRectCover(page: PDFPage, cover: RectCover) {
  const color = cover.color || { r: 1, g: 1, b: 1 };
  page.drawRectangle({
    x: cover.x,
    y: cover.y,
    width: cover.width,
    height: cover.height,
    color: rgb(color.r, color.g, color.b),
    borderWidth: 0,
  });
}

/**
 * Draws text according to FieldPlacement configuration with alignment, wrapping, and cover-up
 */
function drawField(
  page: PDFPage,
  text: string,
  field: FieldPlacement,
  fonts: { normal: PDFFont; bold: PDFFont; oblique: PDFFont }
) {
  if (!text && text !== "0") return;

  const font =
    field.fontName === "Helvetica-Bold"
      ? fonts.bold
      : field.fontName === "Helvetica-Oblique"
      ? fonts.oblique
      : fonts.normal;

  const fontSize = field.fontSize || 9;
  const color = field.color || { r: 0.1, g: 0.1, b: 0.1 };
  const lineHeight = field.lineHeight || fontSize * 1.25;

  if (field.coverPlaceholder) {
    drawRectCover(page, field.coverPlaceholder);
  }

  const maxWidth = field.maxWidth || 300;
  const lines = wrapText(cleanWinAnsi(text), font, fontSize, maxWidth);
  const maxLines = field.maxLines || 10;
  const renderLines = lines.slice(0, maxLines);

  renderLines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, fontSize);
    let startX = field.x;

    if (field.align === "right") {
      startX = field.x - textWidth;
    } else if (field.align === "center") {
      startX = field.x - textWidth / 2;
    }

    const currentY = field.y - index * lineHeight;

    page.drawText(line, {
      x: startX,
      y: currentY,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  });
}

/**
 * Fills template "t2" (Surya Sangam Official Canva Template)
 */
async function fillT2Template(
  pdfDoc: PDFDocument,
  templateConfig: TemplateDefinition,
  data: CalculatedQuotationData
): Promise<Buffer> {
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { normal: fontNormal, bold: fontBold, oblique: fontOblique };

  const pages = pdfDoc.getPages();
  const page1 = pages[0];

  const fields = templateConfig.fields;
  const tableConfig = templateConfig.table;

  // 1. Fill Header Metadata without overlapping
  drawField(page1, data.quotationId, fields.quotationId, fonts);
  drawField(page1, data.quotationDate, fields.issueDate, fonts);

  // 2. Fill Client Information under "Prepared for"
  drawField(page1, data.clientName, fields.clientName, fonts);
  drawField(page1, data.clientAddress, fields.clientAddress, fonts);
  drawField(page1, data.clientEmail, fields.clientEmail, fonts);

  // 3. Line items pagination
  // Single-page mode fits up to 3 items on page 1 above the totals block
  const isMultiPage = data.items.length > 3;

  const drawT2Row = (
    page: PDFPage,
    item: typeof data.items[0],
    index: number,
    y: number,
    isContinuation: boolean
  ) => {
    // Description
    const descFont = fontNormal;
    const descFontSize = 9.0;
    const maxDescWidth = isContinuation ? 260 : 195;
    let desc = item.itemName;
    while (desc.length > 3 && descFont.widthOfTextAtSize(desc + "...", descFontSize) > maxDescWidth) {
      desc = desc.slice(0, -1);
    }
    if (desc !== item.itemName) desc += "...";

    page.drawText(desc, {
      x: 40.0,
      y: y,
      size: descFontSize,
      font: descFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Quantity
    const qtyText = item.quantity.toString();
    const qtyWidth = fontNormal.widthOfTextAtSize(qtyText, 9.0);
    const qtyCenterX = isContinuation ? 335.0 : 265.0;
    page.drawText(qtyText, {
      x: qtyCenterX - qtyWidth / 2,
      y: y,
      size: 9.0,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Unit Price
    const priceText = formatAmount(item.unitPrice);
    const priceWidth = fontNormal.widthOfTextAtSize(priceText, 9.0);
    const priceRightX = isContinuation ? 440.0 : 405.0;
    page.drawText(priceText, {
      x: priceRightX - priceWidth,
      y: y,
      size: 9.0,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Amount (Line Total)
    const amountText = formatAmount(item.lineTotal);
    const amountWidth = fontBold.widthOfTextAtSize(amountText, 9.0);
    const amountRightX = isContinuation ? 550.0 : 550.0;
    page.drawText(amountText, {
      x: amountRightX - amountWidth,
      y: y,
      size: 9.0,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Subtle divider line under continuation rows
    if (isContinuation) {
      page.drawLine({
        start: { x: 35.0, y: y - 4 },
        end: { x: 555.0, y: y - 4 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
    }
  };

  if (!isMultiPage) {
    // ---- SINGLE PAGE MODE (up to 3 items) ----
    // Maintain template provided by user directly without complex redrawing.
    // Original template line at Y = 394.64 is 100% PRESERVED.
    // Mask ONLY the {itemName} placeholder row (Y = 404.0 to 442.0)
    drawRectCover(page1, { x: 35.0, y: 404.0, width: 525.0, height: 38.0 });

    let rowY = data.items.length === 1 ? 420.0 : data.items.length === 2 ? 426.0 : 430.0;
    const rowStep = data.items.length === 3 ? 12.0 : 14.0;
    data.items.forEach((item, idx) => {
      drawT2Row(page1, item, idx, rowY, false);
      rowY -= rowStep;
    });

    // Draw Totals in fixed positions (cover placeholder masks complete width to prevent stray 'al}')
    drawField(page1, formatAmount(data.subtotal), fields.subtotal, fonts);
    drawField(page1, formatAmount(data.taxAmount), fields.taxAmount, fonts);
    drawField(page1, formatAmount(data.grandTotal), fields.grandTotal, fonts);

    // Draw Terms
    if (fields.terms && data.terms && data.terms.length > 0) {
      const termsJoined = data.terms.map((t, idx) => `${idx + 1}. ${t}`).join("\n");
      drawField(page1, termsJoined, fields.terms, fonts);
    }
  } else {
    // ---- MULTI-PAGE OVERFLOW MODE ----
    function paginateT2Items(totalItems: number): number[] {
      if (totalItems <= 3) {
        return [totalItems];
      }
      if (totalItems <= 28) {
        // Balanced 55% / 45% split
        const p1 = Math.min(18, Math.max(Math.ceil(totalItems * 0.55), totalItems - 12));
        return [p1, totalItems - p1];
      }
      const pages: number[] = [];
      const p1Capacity = 18;
      pages.push(p1Capacity);
      let remaining = totalItems - p1Capacity;
      while (remaining > 0) {
        if (remaining <= 16) {
          pages.push(remaining);
          break;
        }
        if (remaining <= 32) {
          const mid = Math.ceil(remaining / 2);
          pages.push(mid);
          pages.push(remaining - mid);
          break;
        }
        pages.push(20);
        remaining -= 20;
      }
      return pages;
    }

    const company = data.companyDetails || {
      name: "Surya Sangam Renewable Energy Pvt Ltd",
      phone: "+91 98765 43210",
      email: "info@suryasangam.com",
      address: "Sector 62, Electronic City, Noida, UP 201309",
    };

    const pageCounts = paginateT2Items(data.items.length);
    const totalPages = pageCounts.length;

    let currentIndex = 0;
    const pageChunks: (typeof data.items)[] = pageCounts.map((count) => {
      const chunk = data.items.slice(currentIndex, currentIndex + count);
      currentIndex += count;
      return chunk;
    });

    const t2LineXStart = 31.83;
    const t2LineXEnd = 561.48;
    const t2LineThickness = 3.0;

    // Page 1: White out everything below the table header across the page
    drawRectCover(page1, { x: 30.0, y: 35.0, width: 535.0, height: 405.0 });

    // Ensure header divider line under Description / Qty is intact and spans full width
    page1.drawLine({
      start: { x: t2LineXStart, y: 444.0 },
      end: { x: t2LineXEnd, y: 444.0 },
      thickness: t2LineThickness,
      color: rgb(0, 0, 0),
    });

    const p1TargetBotY = 70.0;
    const availableHeightP1 = tableConfig.page1.startY - p1TargetBotY;
    const p1RowHeight = Math.min(24.0, Math.max(16.0, (availableHeightP1 - 10.0) / pageChunks[0].length));
    const p1BotY = p1TargetBotY;

    let rowY = tableConfig.page1.startY;
    pageChunks[0].forEach((item, idx) => {
      drawT2Row(page1, item, idx, rowY, false);
      if (idx < pageChunks[0].length - 1) {
        page1.drawLine({
          start: { x: 35.0, y: rowY - 4 },
          end: { x: 555.0, y: rowY - 4 },
          thickness: 0.5,
          color: rgb(0.9, 0.9, 0.9),
        });
      }
      rowY -= p1RowHeight;
    });

    // Page 1 bottom bar (fills comfortably down to ~70.0, eliminating gap)
    page1.drawLine({
      start: { x: t2LineXStart, y: p1BotY },
      end: { x: t2LineXEnd, y: p1BotY },
      thickness: t2LineThickness,
      color: rgb(0, 0, 0),
    });

    // Page 1 Footer (clean, no unnecessary continuation text)
    page1.drawLine({
      start: { x: 35.0, y: 45.0 },
      end: { x: 555.0, y: 45.0 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    const compFooterText = `${cleanWinAnsi(company.phone || "+91 98765 43210")} | ${cleanWinAnsi(company.address || "Sector 62, Noida, UP")} | Email: ${cleanWinAnsi(company.email || "info@suryasangam.com")}`;
    page1.drawText(compFooterText, {
      x: 35.0,
      y: 32.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.45, 0.45, 0.45),
    });
    page1.drawText(`Page 1 of ${totalPages}`, {
      x: 505.0,
      y: 32.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.45, 0.45, 0.45),
    });

    // Continuation Pages (Page 2, 3, etc.)
    for (let pIdx = 1; pIdx < totalPages; pIdx++) {
      const page = pdfDoc.addPage([595.5, 842.25]);
      const isLast = pIdx === totalPages - 1;
      const chunk = pageChunks[pIdx];

      // Top divider bar on continuation page (no repeated headings like Description, Qty)
      page.drawLine({
        start: { x: t2LineXStart, y: 795.0 },
        end: { x: t2LineXEnd, y: 795.0 },
        thickness: t2LineThickness,
        color: rgb(0, 0, 0),
      });

      let contY = 780.0;
      const targetBottomBarY = Math.max(340.0, Math.min(540.0, 780.0 - (chunk.length * 20.0 + 35.0)));
      const contRowHeight = Math.min(22.0, Math.max(16.0, (780.0 - targetBottomBarY - 35.0) / chunk.length));
      const globalOffset = pageChunks.slice(0, pIdx).reduce((acc, c) => acc + c.length, 0);

      chunk.forEach((item, i) => {
        drawT2Row(page, item, globalOffset + i, contY, true);
        contY -= contRowHeight;
      });

      if (isLast) {
        // Table bottom bar
        const bottomBarY = targetBottomBarY + 14.0;
        page.drawLine({
          start: { x: t2LineXStart, y: bottomBarY },
          end: { x: t2LineXEnd, y: bottomBarY },
          thickness: t2LineThickness,
          color: rgb(0, 0, 0),
        });

        // Anchor totals and terms smoothly without leaving a huge bottom void
        const requiredBottomHeight = 250.0;
        const totalsBoxY = Math.min(bottomBarY - 14.0, Math.max(65.0 + requiredBottomHeight, 330.0));
        page.drawRectangle({
          x: 320.0,
          y: totalsBoxY - 65,
          width: 235.0,
          height: 68.0,
          color: rgb(0.98, 0.98, 0.98),
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 1,
        });

        page.drawText("Subtotal:", {
          x: 330.0,
          y: totalsBoxY - 16,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.15, 0.15, 0.15),
        });
        const subText = formatAmount(data.subtotal);
        page.drawText(subText, {
          x: 545.0 - fontNormal.widthOfTextAtSize(subText, 9.5),
          y: totalsBoxY - 16,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.1, 0.1, 0.1),
        });

        page.drawText(`GST / Tax (${data.taxRate}%):`, {
          x: 330.0,
          y: totalsBoxY - 34,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.15, 0.15, 0.15),
        });
        const taxText = formatAmount(data.taxAmount);
        page.drawText(taxText, {
          x: 545.0 - fontNormal.widthOfTextAtSize(taxText, 9.5),
          y: totalsBoxY - 34,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.1, 0.1, 0.1),
        });

        page.drawText("Grand Total:", {
          x: 330.0,
          y: totalsBoxY - 54,
          size: 11.0,
          font: fontBold,
          color: rgb(0.05, 0.05, 0.05),
        });
        const grandText = `INR ${formatAmount(data.grandTotal)}`;
        page.drawText(grandText, {
          x: 545.0 - fontBold.widthOfTextAtSize(grandText, 11.0),
          y: totalsBoxY - 54,
          size: 11.0,
          font: fontBold,
          color: rgb(0.08, 0.45, 0.2),
        });

        let nextSectionY = totalsBoxY - 78.0;

        // Total Payable Amount in words
        if (data.totalPayableInWords) {
          page.drawText(`Total Payable Amount (in words): ${cleanWinAnsi(data.totalPayableInWords)}`, {
            x: 35.0,
            y: nextSectionY,
            size: 8.5,
            font: fontBold,
            color: rgb(0.15, 0.15, 0.15),
          });
          nextSectionY -= 15.0;
        }

        // Section divider
        page.drawLine({
          start: { x: 35.0, y: nextSectionY },
          end: { x: 555.0, y: nextSectionY },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
        nextSectionY -= 14.0;

        // Payment Info / Bank details on Continuation Final Page
        if (company.bankName || company.accountNumber) {
          page.drawText("Payment Info / Bank Account", {
            x: 35.0,
            y: nextSectionY,
            size: 9.0,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
          });
          nextSectionY -= 13.0;

          const bankLine1 = `Account Holder: ${cleanWinAnsi(company.accountHolder || company.name)} | Bank: ${cleanWinAnsi(company.bankName || "HDFC Bank Ltd")}`;
          page.drawText(bankLine1, {
            x: 35.0,
            y: nextSectionY,
            size: 7.5,
            font: fontNormal,
            color: rgb(0.25, 0.25, 0.25),
          });
          nextSectionY -= 12.0;

          const bankLine2 = `Account No.: ${cleanWinAnsi(company.accountNumber || "50200012345678")} | IFSC: ${cleanWinAnsi(company.ifscCode || "HDFC0001234")}`;
          page.drawText(bankLine2, {
            x: 35.0,
            y: nextSectionY,
            size: 7.5,
            font: fontNormal,
            color: rgb(0.25, 0.25, 0.25),
          });
          nextSectionY -= 16.0;
        }

        // Terms and conditions below totals on final page
        if (data.terms && data.terms.length > 0 && nextSectionY > 70) {
          page.drawText("Terms and conditions", {
            x: 35.0,
            y: nextSectionY,
            size: 9.5,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
          });

          data.terms.forEach((t, tIdx) => {
            const termLineY = nextSectionY - 14 - tIdx * 13;
            if (termLineY > 50) {
              page.drawText(`${tIdx + 1}. ${cleanWinAnsi(t)}`, {
                x: 35.0,
                y: termLineY,
                size: 8.0,
                font: fontNormal,
                color: rgb(0.2, 0.2, 0.2),
              });
            }
          });
        }
      }

      // Continuation page footer
      page.drawLine({
        start: { x: 35.0, y: 45.0 },
        end: { x: 555.0, y: 45.0 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      page.drawText(compFooterText, {
        x: 35.0,
        y: 32.0,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.45, 0.45, 0.45),
      });
      page.drawText(`Page ${pIdx + 1} of ${totalPages}`, {
        x: 505.0,
        y: 32.0,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.45, 0.45, 0.45),
      });
    }
  }

  const savedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(savedPdfBytes);
}

/**
 * Fills template "t3" (Solar Technical & Pricing Specification Template - A4 595.92 x 842.88)
 */
async function fillT3Template(
  pdfDoc: PDFDocument,
  templateConfig: TemplateDefinition,
  data: CalculatedQuotationData
): Promise<Buffer> {
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const company = data.companyDetails;

  // 1. Top Header Metadata: Quotation No. and Date
  // Label "Quotation No. :" starts at X=42.52, Y=792.63 and ends at X~97; placeholder {quotationNo} is at X~98..220
  drawRectCover(page1, { x: 97.0, y: 786.0, width: 160.0, height: 16.0 });
  page1.drawText(cleanWinAnsi(data.quotationId), {
    x: 100.0,
    y: 792.63,
    size: 8.0,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Label "Date :" starts at X=477.30, Y=792.63 and ends at X~497; placeholder {quotationDate} is at X~498..570
  drawRectCover(page1, { x: 497.0, y: 786.0, width: 75.0, height: 16.0 });
  page1.drawText(cleanWinAnsi(data.quotationDate), {
    x: 502.0,
    y: 792.63,
    size: 8.0,
    font: fontNormal,
    color: rgb(0.1, 0.1, 0.1),
  });

  // 2. Company Details (Left column: X = 42.52)
  // Mask underlying template company placeholders: [{companyName}], {companyAddress}, Phone, Email, GSTIN
  drawRectCover(page1, { x: 42.0, y: 726.0, width: 255.0, height: 60.0 });

  page1.drawText(cleanWinAnsi(company.name || "Surya Sangam Renewable Energy Pvt Ltd"), {
    x: 42.52,
    y: 775.38,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page1.drawText(cleanWinAnsi(company.address || "Sector 62, Electronic City, Noida, UP 201309"), {
    x: 42.52,
    y: 764.88,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  page1.drawText(`Phone: ${cleanWinAnsi(company.phone || "+91 98765 43210")}`, {
    x: 42.52,
    y: 754.38,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  page1.drawText(`Email: ${cleanWinAnsi(company.email || "info@suryasangam.com")}`, {
    x: 42.52,
    y: 743.88,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  page1.drawText(`GSTIN: ${cleanWinAnsi(company.gstin || "07AAAAA0000A1Z5")}`, {
    x: 42.52,
    y: 733.38,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  // 3. Customer Details (Right column: X = 303.75)
  // Mask underlying template customer placeholders cleanly
  drawRectCover(page1, { x: 302.0, y: 718.0, width: 265.0, height: 66.0 });

  page1.drawText("Customer details", {
    x: 303.75,
    y: 776.13,
    size: 8.0,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  let custName = cleanWinAnsi(data.clientName);
  while (custName.length > 3 && fontBold.widthOfTextAtSize(`Customer/business: ${custName}...`, 7.5) > 250) {
    custName = custName.slice(0, -1);
  }
  if (custName !== cleanWinAnsi(data.clientName)) custName += "...";
  page1.drawText(`Customer/business: ${custName}`, {
    x: 303.75,
    y: 766.38,
    size: 7.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  let custAddr = cleanWinAnsi(data.clientAddress);
  while (custAddr.length > 3 && fontNormal.widthOfTextAtSize(`Address: ${custAddr}...`, 7.0) > 250) {
    custAddr = custAddr.slice(0, -1);
  }
  if (custAddr !== cleanWinAnsi(data.clientAddress)) custAddr += "...";
  page1.drawText(`Address: ${custAddr}`, {
    x: 303.75,
    y: 755.88,
    size: 7.0,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  const contactName = cleanWinAnsi(data.contactPerson) || cleanWinAnsi(data.clientName);
  page1.drawText(`Contact person: ${contactName}`, {
    x: 303.75,
    y: 745.38,
    size: 7.0,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  const custPhone = cleanWinAnsi(data.clientPhone) || "N/A";
  page1.drawText(`Phone: ${custPhone}`, {
    x: 303.75,
    y: 734.88,
    size: 7.0,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  page1.drawText(`Email: ${cleanWinAnsi(data.clientEmail)}`, {
    x: 303.75,
    y: 724.38,
    size: 7.0,
    font: fontNormal,
    color: rgb(0.25, 0.25, 0.25),
  });

  // 4. Subject & Introduction
  drawRectCover(page1, { x: 74.0, y: 705.0, width: 485.0, height: 14.0 });
  page1.drawText("Commercial Quotation for Solar PV Supply & Installation", {
    x: 76.0,
    y: 710.88,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.15, 0.15, 0.15),
  });

  drawRectCover(page1, { x: 42.0, y: 682.0, width: 520.0, height: 14.0 });
  page1.drawText("We are pleased to submit our commercial quotation based on your technical system requirements as outlined below:", {
    x: 42.52,
    y: 688.38,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Helper to draw a single t3 line item row across the 7 columns
  const drawT3Row = (
    page: PDFPage,
    item: typeof data.items[0],
    index: number,
    y: number
  ) => {
    // Col 1: S. No. (center around X=54)
    const idxStr = (index + 1).toString();
    const idxW = fontNormal.widthOfTextAtSize(idxStr, 7.5);
    page.drawText(idxStr, {
      x: 54.0 - idxW / 2,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 2: Type / Capacity of product / system specifications (left-aligned X=88, max width 115)
    let desc = cleanWinAnsi(item.itemName);
    while (desc.length > 3 && fontNormal.widthOfTextAtSize(desc + "...", 7.0) > 115) {
      desc = desc.slice(0, -1);
    }
    if (desc !== cleanWinAnsi(item.itemName)) desc += "...";
    page.drawText(desc, {
      x: 88.0,
      y,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 3: Unit Cost (INR) - excludes GST (right-aligned to X=258)
    const costText = formatAmount(item.unitPrice);
    const costW = fontNormal.widthOfTextAtSize(costText, 7.5);
    page.drawText(costText, {
      x: 258.0 - costW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 4: Unit GST (INR) (right-aligned to X=318)
    const unitGst = (item.unitPrice * data.taxRate) / 100;
    const gstText = formatAmount(unitGst);
    const gstW = fontNormal.widthOfTextAtSize(gstText, 7.5);
    page.drawText(gstText, {
      x: 318.0 - gstW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 5: Unit Rate incl. GST (right-aligned to X=398)
    const unitRateIncl = item.unitPrice + unitGst;
    const rateText = formatAmount(unitRateIncl);
    const rateW = fontNormal.widthOfTextAtSize(rateText, 7.5);
    page.drawText(rateText, {
      x: 398.0 - rateW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 6: No. of Units (right-aligned to X=452)
    const qtyText = item.quantity.toString();
    const qtyW = fontNormal.widthOfTextAtSize(qtyText, 7.5);
    page.drawText(qtyText, {
      x: 452.0 - qtyW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 7: Total Cost incl. GST (right-aligned to X=548)
    const totalInclGst = unitRateIncl * item.quantity;
    const totalText = formatAmount(totalInclGst);
    const totalW = fontBold.widthOfTextAtSize(totalText, 7.5);
    page.drawText(totalText, {
      x: 548.0 - totalW,
      y,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const isMultiPage = data.items.length > 3;

  if (!isMultiPage) {
    // ---------------- SINGLE PAGE MODE (<= 3 items) ----------------
    // Maintain template provided by user directly without complex redrawing.
    // Original template table lines, borders, and boxes are 100% PRESERVED.
    // Mask ONLY the placeholder text inside the cell boundaries:
    // Row 1 text area: Y = 618.5..630.5
    drawRectCover(page1, { x: 44.0, y: 618.5, width: 507.0, height: 12.5 });
    // Row 2 text area: Y = 603.5..615.5
    drawRectCover(page1, { x: 44.0, y: 603.5, width: 507.0, height: 12.5 });
    // Row 3 text area: Y = 588.5..600.5
    drawRectCover(page1, { x: 44.0, y: 588.5, width: 507.0, height: 12.5 });
    // Grand Total text area: Y = 573.5..585.5
    drawRectCover(page1, { x: 44.0, y: 573.5, width: 507.0, height: 12.5 });

    const rowYs = [621.88, 606.88, 591.88];
    data.items.forEach((item, idx) => {
      drawT3Row(page1, item, idx, rowYs[idx]);
    });

    // Grand Total label & values (pre-printed table lines at 632.13, 617.13, 602.13, 587.13, 572.13 remain intact)
    page1.drawText("Grand Total", {
      x: 350.0,
      y: 576.88,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const unitsStr = data.totalUnits.toString();
    const unitsW = fontBold.widthOfTextAtSize(unitsStr, 7.5);
    page1.drawText(unitsStr, {
      x: 452.0 - unitsW,
      y: 576.88,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const gtStr = formatAmount(data.grandTotal);
    const gtW = fontBold.widthOfTextAtSize(gtStr, 7.5);
    page1.drawText(gtStr, {
      x: 548.0 - gtW,
      y: 576.88,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Summary Boxes (Y = 540.63) - preserve pre-drawn box outlines
    // Box 1: Subtotal before GST
    drawRectCover(page1, { x: 45.0, y: 537.0, width: 160.0, height: 13.0 });
    page1.drawText(formatAmount(data.subtotal), {
      x: 46.27,
      y: 540.63,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Box 2: GST amount
    drawRectCover(page1, { x: 215.0, y: 537.0, width: 100.0, height: 13.0 });
    page1.drawText(formatAmount(data.taxAmount), {
      x: 217.01,
      y: 540.63,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Box 3: Final amount including GST
    drawRectCover(page1, { x: 325.0, y: 537.0, width: 228.0, height: 13.0 });
    page1.drawText(`INR ${formatAmount(data.grandTotal)}`, {
      x: 327.61,
      y: 540.63,
      size: 9.0,
      font: fontBold,
      color: rgb(0.08, 0.45, 0.2),
    });

    // Date & sign (Y = 521.88) - label is pre-printed at X=42.52, Y=521.88
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 95.0,
      y: 521.88,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText(`Auth. Signatory: ${cleanWinAnsi(company.name)}`, {
      x: 42.52,
      y: 509.0,
      size: 7.0,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.25),
    });

    // Total Payable Amount in words (Y = 511.38)
    drawRectCover(page1, { x: 350.0, y: 496.0, width: 215.0, height: 22.0 });
    const inWordsText = cleanWinAnsi(data.totalPayableInWords);
    const wordsLines = wrapText(inWordsText, fontBold, 6.5, 210);
    let curWordY = 511.38;
    for (const wLine of wordsLines.slice(0, 2)) {
      const wWidth = fontBold.widthOfTextAtSize(wLine, 6.5);
      page1.drawText(wLine, {
        x: 548.0 - wWidth,
        y: curWordY,
        size: 6.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      curWordY -= 8.5;
    }

    // Warranty & Delivery placeholders (Y = 484.38 to 464.13)
    drawRectCover(page1, { x: 42.0, y: 460.0, width: 518.0, height: 32.0 });
    const term1 = getCleanTerm(data.terms?.[0], "5 Years Comprehensive Onsite Warranty");
    const term2 = getCleanTerm(data.terms?.[1], "10 - 15 Business Days from confirmation");
    const term3 = getCleanTerm(data.terms?.[2], "30 Days from date of issuance");
    page1.drawText(`Warranty coverage and duration: ${term1}`, {
      x: 42.52,
      y: 484.38,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText(`Delivery / installation period: ${term2}`, {
      x: 42.52,
      y: 473.88,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText(`Quotation validity: ${term3}`, {
      x: 42.52,
      y: 464.13,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Bank Account Details (Y = 447.63 to 416.13)
    drawRectCover(page1, { x: 42.0, y: 412.0, width: 518.0, height: 32.0 });
    page1.drawText(`Account holder: ${cleanWinAnsi(company.accountHolder || company.name)}`, {
      x: 42.52,
      y: 437.13,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText(`Bank: ${cleanWinAnsi(company.bankName || "HDFC Bank Ltd")} | Account No.: ${cleanWinAnsi(company.accountNumber || "50200012345678")}`, {
      x: 42.52,
      y: 426.63,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText(`IFSC: ${cleanWinAnsi(company.ifscCode || "HDFC0001234")} | Branch: ${cleanWinAnsi(company.branch || "Noida Sector 62 Branch")}`, {
      x: 42.52,
      y: 416.13,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Page 1 Footer (Y = 37.38)
    drawRectCover(page1, { x: 40.0, y: 30.0, width: 525.0, height: 18.0 });
    page1.drawText(`${cleanWinAnsi(company.phone)} | ${cleanWinAnsi(company.address)} | ${cleanWinAnsi(company.website || "www.suryasangam.com")} | Email: ${cleanWinAnsi(company.email)}`, {
      x: 42.52,
      y: 37.38,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });
    page1.drawText("Page 1 of 1", {
      x: 525.0,
      y: 37.38,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });
    page1.drawText("Page 1 of 1", {
      x: 525.0,
      y: 37.38,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });
  } else {
    // ---------------- MULTI-PAGE OVERFLOW MODE (> 4 items) ----------------
    function paginateT3Items(totalItems: number): number[] {
      if (totalItems <= 3) {
        return [totalItems];
      }
      if (totalItems <= 28) {
        // Balanced 55% / 45% split
        const p1 = Math.min(18, Math.max(Math.ceil(totalItems * 0.55), totalItems - 12));
        return [p1, totalItems - p1];
      }
      const pages: number[] = [];
      const p1Capacity = 18;
      pages.push(p1Capacity);
      let remaining = totalItems - p1Capacity;
      while (remaining > 0) {
        if (remaining <= 16) {
          pages.push(remaining);
          break;
        }
        if (remaining <= 32) {
          const mid = Math.ceil(remaining / 2);
          pages.push(mid);
          pages.push(remaining - mid);
          break;
        }
        pages.push(20);
        remaining -= 20;
      }
      return pages;
    }

    const pageCounts = paginateT3Items(data.items.length);
    const totalPages = pageCounts.length;

    let currentIndex = 0;
    const pageChunks: (typeof data.items)[] = pageCounts.map((count) => {
      const chunk = data.items.slice(currentIndex, currentIndex + count);
      currentIndex += count;
      return chunk;
    });

    // Page 1: White out the lower area below the pre-printed table header
    const p1TableTopY = 632.13;
    const p1TargetBotY = 70.0;
    const t3LeftX = 42.75;
    const t3RightX = 552.75;
    const t3Dividers = [101.25, 205.50, 266.25, 321.75, 404.25, 474.00];

    drawRectCover(page1, { x: 38.0, y: 48.0, width: 520.0, height: p1TableTopY - 48.0 });

    const availableHeightP1 = p1TableTopY - p1TargetBotY;
    const p1RowHeight = Math.min(24.0, Math.max(16.5, (availableHeightP1 - 10.0) / pageChunks[0].length));
    const p1BotY = p1TargetBotY;

    let rowY = 620.0;
    pageChunks[0].forEach((item, idx) => {
      drawT3Row(page1, item, idx, rowY);
      if (idx < pageChunks[0].length - 1) {
        page1.drawLine({
          start: { x: t3LeftX, y: rowY - 4.0 },
          end: { x: t3RightX, y: rowY - 4.0 },
          thickness: 0.5,
          color: rgb(0.85, 0.85, 0.85),
        });
      }
      rowY -= p1RowHeight;
    });

    // Header bottom line
    page1.drawLine({
      start: { x: t3LeftX, y: p1TableTopY },
      end: { x: t3RightX, y: p1TableTopY },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
    // Page 1 bottom border
    page1.drawLine({
      start: { x: t3LeftX, y: p1BotY },
      end: { x: t3RightX, y: p1BotY },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
    // Outer side borders
    page1.drawLine({
      start: { x: t3LeftX, y: p1TableTopY },
      end: { x: t3LeftX, y: p1BotY },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
    page1.drawLine({
      start: { x: t3RightX, y: p1TableTopY },
      end: { x: t3RightX, y: p1BotY },
      thickness: 0.8,
      color: rgb(0.1, 0.1, 0.1),
    });
    // Vertical column dividers
    t3Dividers.forEach((x) => {
      page1.drawLine({
        start: { x, y: p1TableTopY },
        end: { x, y: p1BotY },
        thickness: 0.8,
        color: rgb(0.1, 0.1, 0.1),
      });
    });

    // Page 1 Footer: clean, no unnecessary text
    drawRectCover(page1, { x: 40.0, y: 30.0, width: 525.0, height: 18.0 });
    page1.drawText(`${cleanWinAnsi(company.phone)} | ${cleanWinAnsi(company.address)} | Email: ${cleanWinAnsi(company.email)}`, {
      x: 42.52,
      y: 37.38,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });
    page1.drawText(`Page 1 of ${totalPages}`, {
      x: 515.0,
      y: 37.38,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Continuation Pages (Page 2, 3, etc.)
    for (let pIdx = 1; pIdx < totalPages; pIdx++) {
      const page = pdfDoc.addPage([595.92, 842.88]);
      const chunk = pageChunks[pIdx];
      const isLast = pIdx === totalPages - 1;

      // Outer border matching Page 1
      page.drawRectangle({
        x: 35.0,
        y: 30.0,
        width: 525.92,
        height: 778.0,
        borderColor: rgb(0.1, 0.1, 0.1),
        borderWidth: 0.8,
      });

      // Sleek top divider line on continuation page (no repeated headings like S. No, Type, etc.)
      const contTableTopY = 795.0;
      page.drawLine({
        start: { x: t3LeftX, y: contTableTopY },
        end: { x: t3RightX, y: contTableTopY },
        thickness: 1.0,
        color: rgb(0.1, 0.1, 0.1),
      });

      let contY = 780.0;
      const targetGtBarBotY = Math.max(340.0, Math.min(540.0, 795.0 - (chunk.length * 20.0 + 35.0)));
      const contRowHeight = Math.min(22.0, Math.max(16.0, (795.0 - targetGtBarBotY - 35.0) / chunk.length));
      const globalOffset = pageChunks.slice(0, pIdx).reduce((acc, c) => acc + c.length, 0);

      chunk.forEach((item, i) => {
        drawT3Row(page, item, globalOffset + i, contY);
        page.drawLine({
          start: { x: t3LeftX, y: contY - 3.5 },
          end: { x: t3RightX, y: contY - 3.5 },
          thickness: 0.5,
          color: rgb(0.92, 0.92, 0.92),
        });
        contY -= contRowHeight;
      });

      const contItemsBotY = targetGtBarBotY + 14.0;

      if (isLast) {
        // Grand Total Bar and Summary Blocks on Final Page
        const totalsY = contItemsBotY;
        const gtBarBotY = totalsY - 14.0;

        // Draw Table outer borders from contTableTopY to gtBarBotY
        page.drawLine({
          start: { x: t3LeftX, y: contTableTopY },
          end: { x: t3LeftX, y: gtBarBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: t3RightX, y: contTableTopY },
          end: { x: t3RightX, y: gtBarBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        // Table bottom border under Grand Total
        page.drawLine({
          start: { x: t3LeftX, y: gtBarBotY },
          end: { x: t3RightX, y: gtBarBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        // Line above Grand Total (below items)
        page.drawLine({
          start: { x: t3LeftX, y: totalsY },
          end: { x: t3RightX, y: totalsY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Vertical column dividers in the item rows (from contTableTopY to totalsY)
        t3Dividers.forEach((x) => {
          page.drawLine({
            start: { x, y: contTableTopY },
            end: { x, y: totalsY },
            thickness: 0.8,
            color: rgb(0.1, 0.1, 0.1),
          });
        });

        // Vertical dividers in Grand Total bar
        [404.25, 474.00].forEach((x) => {
          page.drawLine({
            start: { x, y: totalsY },
            end: { x, y: gtBarBotY },
            thickness: 0.8,
            color: rgb(0.1, 0.1, 0.1),
          });
        });

        page.drawText("Grand Total", {
          x: 350.0,
          y: totalsY - 9.0,
          size: 8.0,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        const unitsStr = data.totalUnits.toString();
        const unitsW = fontBold.widthOfTextAtSize(unitsStr, 8.0);
        page.drawText(unitsStr, {
          x: 452.0 - unitsW,
          y: totalsY - 9.0,
          size: 8.0,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        const gtStr = `INR ${formatAmount(data.grandTotal)}`;
        const gtW = fontBold.widthOfTextAtSize(gtStr, 8.5);
        page.drawText(gtStr, {
          x: 548.0 - gtW,
          y: totalsY - 9.0,
          size: 8.5,
          font: fontBold,
          color: rgb(0.08, 0.45, 0.2),
        });

        // 3 Summary Boxes on Final Page
        const boxY = totalsY - 48.0;
        const boxH = 28.0;

        // Subtotal Box
        page.drawRectangle({
          x: 42.0,
          y: boxY,
          width: 160.0,
          height: boxH,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.6,
        });
        page.drawText("Subtotal before GST", {
          x: 46.27,
          y: boxY + 16.0,
          size: 7.5,
          font: fontBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(formatAmount(data.subtotal), {
          x: 46.27,
          y: boxY + 4.0,
          size: 8.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // GST Box
        page.drawRectangle({
          x: 215.0,
          y: boxY,
          width: 100.0,
          height: boxH,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.6,
        });
        page.drawText(`GST amount (${data.taxRate}%)`, {
          x: 219.0,
          y: boxY + 16.0,
          size: 7.5,
          font: fontBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(formatAmount(data.taxAmount), {
          x: 219.0,
          y: boxY + 4.0,
          size: 8.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Final Total Box
        page.drawRectangle({
          x: 328.0,
          y: boxY,
          width: 226.0,
          height: boxH,
          color: rgb(0.97, 0.99, 0.97),
          borderColor: rgb(0.2, 0.5, 0.2),
          borderWidth: 0.8,
        });
        page.drawText("Final amount including GST", {
          x: 334.0,
          y: boxY + 16.0,
          size: 7.5,
          font: fontBold,
          color: rgb(0.1, 0.4, 0.1),
        });
        page.drawText(`INR ${formatAmount(data.grandTotal)}`, {
          x: 334.0,
          y: boxY + 4.0,
          size: 9.5,
          font: fontBold,
          color: rgb(0.08, 0.45, 0.2),
        });

        // Total Payable in Words
        page.drawText(`Total Payable Amount (in words): ${cleanWinAnsi(data.totalPayableInWords)}`, {
          x: 42.52,
          y: totalsY - 64.0,
          size: 7.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Date & Sign on Final Page
        page.drawText(`Date: ${cleanWinAnsi(data.quotationDate)} | Auth. Signatory: ${cleanWinAnsi(company.name)}`, {
          x: 42.52,
          y: totalsY - 76.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Warranty & Delivery on Final Page
        const wY = totalsY - 94.0;
        page.drawText("WARRANTY AND DELIVERY TERMS", {
          x: 42.52,
          y: wY,
          size: 8.0,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        const mTerm1 = getCleanTerm(data.terms?.[0], "5 Years Comprehensive Onsite Warranty");
        const mTerm2 = getCleanTerm(data.terms?.[1], "10 - 15 Business Days from confirmation");
        const mTerm3 = getCleanTerm(data.terms?.[2], "30 Days from date of issuance");
        page.drawText(`• Warranty coverage and duration: ${mTerm1}`, {
          x: 42.52,
          y: wY - 12.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`• Delivery / installation period: ${mTerm2}`, {
          x: 42.52,
          y: wY - 23.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`• Quotation validity: ${mTerm3}`, {
          x: 42.52,
          y: wY - 34.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });

        // Bank Account Details on Final Page
        const bY = totalsY - 146.0;
        page.drawText("BANK ACCOUNT DETAILS", {
          x: 42.52,
          y: bY,
          size: 8.0,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawText(`Account holder: ${cleanWinAnsi(company.accountHolder || company.name)}`, {
          x: 42.52,
          y: bY - 12.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`Bank: ${cleanWinAnsi(company.bankName || "HDFC Bank Ltd")} | Account No.: ${cleanWinAnsi(company.accountNumber || "50200012345678")}`, {
          x: 42.52,
          y: bY - 23.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`IFSC: ${cleanWinAnsi(company.ifscCode || "HDFC0001234")} | Branch: ${cleanWinAnsi(company.branch || "Noida Sector 62 Branch")}`, {
          x: 42.52,
          y: bY - 34.0,
          size: 7.0,
          font: fontNormal,
          color: rgb(0.2, 0.2, 0.2),
        });
      } else {
        // Intermediate continuation page: close table box cleanly
        page.drawLine({
          start: { x: t3LeftX, y: contItemsBotY },
          end: { x: t3RightX, y: contItemsBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: t3LeftX, y: contTableTopY },
          end: { x: t3LeftX, y: contItemsBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: t3RightX, y: contTableTopY },
          end: { x: t3RightX, y: contItemsBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });
        t3Dividers.forEach((x) => {
          page.drawLine({
            start: { x, y: contTableTopY },
            end: { x, y: contItemsBotY },
            thickness: 0.8,
            color: rgb(0.1, 0.1, 0.1),
          });
        });
      }

      // Continuation Page Footer
      page.drawLine({
        start: { x: 35.0, y: 48.0 },
        end: { x: 560.92, y: 48.0 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      page.drawText(`${cleanWinAnsi(company.phone)} | ${cleanWinAnsi(company.address)} | Email: ${cleanWinAnsi(company.email)}`, {
        x: 42.52,
        y: 37.38,
        size: 7.0,
        font: fontNormal,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText(`Page ${pIdx + 1} of ${totalPages}`, {
        x: 515.0,
        y: 37.38,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const savedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(savedPdfBytes);
}

/**
 * Fills template "t4" (Product Specifications & Pricing Template - Letter 612 x 792)
 *
 * User requirements:
 * 1. Automatic GST calculation at given tax percent (default 18%).
 * 2. Add all items into the product specifications table (Col 2: Type / Capacity of product).
 * 3. 6 columns: S. No. | Type / Capacity of product | Unit Cost (INR) | Unit GST (INR) | No. of Units | Total Cost (incl. GST).
 * 4. Headings only on Page 1 (no repeated headings on continuation pages).
 * 5. No large unnecessary blank spaces at page bottom (dynamic row sizing, anchored footer/summary).
 */
async function fillT4Template(
  pdfDoc: PDFDocument,
  templateConfig: TemplateDefinition,
  data: CalculatedQuotationData
): Promise<Buffer> {
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const company = data.companyDetails;
  const taxRate = data.taxRate !== undefined ? data.taxRate : 18;
  const allItems = data.items;
  const isMultiPage = allItems.length > 3;

  // Support custom row2 / row3 entries or fallback to defaults
  const row2Desc = data.row2Description || "Product / service and specifications";
  const row2Price = Number(data.row2UnitPrice) || 0;
  const row2Qty = Number(data.row2Quantity) || 1;

  const row3Desc = data.row3Description || "Installation / other charges, if applicable";
  const row3Price = Number(data.row3UnitPrice) || 0;
  const row3Qty = Number(data.row3Quantity) || 1;

  const term1 = getCleanTerm(data.terms?.[1] || data.terms?.[0], "5 Years Standard Warranty");
  const term2 = getCleanTerm(data.terms?.[2], "3-4 Weeks after Advance PO");
  const term3 = getCleanTerm(data.terms?.[0], "30 Days from quotation date");

  // Row 1 Item Line Renderer (inside cell of Row 1)
  const drawT4ItemLine = (
    page: PDFPage,
    item: typeof data.items[0],
    y: number
  ) => {
    const unitCost = item.unitPrice;
    const unitGst = roundToTwoDecimals((unitCost * taxRate) / 100);
    const unitRateIncl = roundToTwoDecimals(unitCost + unitGst);
    const totalCostIncl = roundToTwoDecimals(item.quantity * unitRateIncl);

    // Col 2: Type / Capacity of product (Product Specifications)
    let desc = cleanWinAnsi(item.itemName);
    while (desc.length > 3 && fontNormal.widthOfTextAtSize(desc + "...", 7.5) > 170) {
      desc = desc.slice(0, -1);
    }
    if (desc !== cleanWinAnsi(item.itemName)) desc += "...";
    page.drawText(desc, {
      x: 98.0,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 3: Unit Cost (INR) (right-aligned to 350.0)
    const costText = formatAmount(unitCost);
    const costW = fontNormal.widthOfTextAtSize(costText, 7.5);
    page.drawText(costText, {
      x: 350.0 - costW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 4: Unit GST (INR) (right-aligned to 401.0)
    const gstText = formatAmount(unitGst);
    const gstW = fontNormal.widthOfTextAtSize(gstText, 7.5);
    page.drawText(gstText, {
      x: 401.0 - gstW,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 5: No. of Units (center = 425.0)
    const qtyText = item.quantity.toString();
    const qtyW = fontNormal.widthOfTextAtSize(qtyText, 7.5);
    page.drawText(qtyText, {
      x: 425.0 - qtyW / 2,
      y,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Col 6: Total Cost (incl. GST) (right-aligned to 572.0)
    const totalText = formatAmount(totalCostIncl);
    const totalW = fontBold.widthOfTextAtSize(totalText, 7.5);
    page.drawText(totalText, {
      x: 572.0 - totalW,
      y,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  // Helper to draw Row 2: "Product / service and specifications"
  const drawRow2 = (page: PDFPage, textY: number) => {
    page.drawText("2", {
      x: 66.0 - fontNormal.widthOfTextAtSize("2", 7.5) / 2,
      y: textY,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });
    let d2 = cleanWinAnsi(row2Desc);
    while (d2.length > 3 && fontNormal.widthOfTextAtSize(d2 + "...", 7.5) > 170) {
      d2 = d2.slice(0, -1);
    }
    if (d2 !== cleanWinAnsi(row2Desc)) d2 += "...";
    page.drawText(d2, {
      x: 98.0,
      y: textY,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });
    if (row2Price > 0) {
      const sCost = row2Price;
      const sGst = roundToTwoDecimals((sCost * taxRate) / 100);
      const sIncl = roundToTwoDecimals(sCost + sGst);
      const sTotal = roundToTwoDecimals(row2Qty * sIncl);
      const costStr = formatAmount(sCost);
      page.drawText(costStr, { x: 350.0 - fontNormal.widthOfTextAtSize(costStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const gstStr = formatAmount(sGst);
      page.drawText(gstStr, { x: 401.0 - fontNormal.widthOfTextAtSize(gstStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const qStr = row2Qty.toString();
      page.drawText(qStr, { x: 425.0 - fontNormal.widthOfTextAtSize(qStr, 7.5) / 2, y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const tStr = formatAmount(sTotal);
      page.drawText(tStr, { x: 572.0 - fontBold.widthOfTextAtSize(tStr, 7.5), y: textY, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    } else {
      page.drawText("-", { x: 345.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("-", { x: 395.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("-", { x: 423.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      const incStr = "Included";
      page.drawText(incStr, { x: 572.0 - fontNormal.widthOfTextAtSize(incStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.3, 0.3, 0.3) });
    }
  };

  // Helper to draw Row 3: "Installation / other charges, if applicable"
  const drawRow3 = (page: PDFPage, textY: number) => {
    page.drawText("3", {
      x: 66.0 - fontNormal.widthOfTextAtSize("3", 7.5) / 2,
      y: textY,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });
    let d3 = cleanWinAnsi(row3Desc);
    while (d3.length > 3 && fontNormal.widthOfTextAtSize(d3 + "...", 7.5) > 170) {
      d3 = d3.slice(0, -1);
    }
    if (d3 !== cleanWinAnsi(row3Desc)) d3 += "...";
    page.drawText(d3, {
      x: 98.0,
      y: textY,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });
    if (row3Price > 0) {
      const iCost = row3Price;
      const iGst = roundToTwoDecimals((iCost * taxRate) / 100);
      const iIncl = roundToTwoDecimals(iCost + iGst);
      const iTotal = roundToTwoDecimals(row3Qty * iIncl);
      const costStr = formatAmount(iCost);
      page.drawText(costStr, { x: 350.0 - fontNormal.widthOfTextAtSize(costStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const gstStr = formatAmount(iGst);
      page.drawText(gstStr, { x: 401.0 - fontNormal.widthOfTextAtSize(gstStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const qStr = row3Qty.toString();
      page.drawText(qStr, { x: 425.0 - fontNormal.widthOfTextAtSize(qStr, 7.5) / 2, y: textY, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const tStr = formatAmount(iTotal);
      page.drawText(tStr, { x: 572.0 - fontBold.widthOfTextAtSize(tStr, 7.5), y: textY, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    } else {
      page.drawText("-", { x: 345.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("-", { x: 395.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("-", { x: 423.0, y: textY, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      const incStr = "Included";
      page.drawText(incStr, { x: 572.0 - fontNormal.widthOfTextAtSize(incStr, 7.5), y: textY, size: 7.5, font: fontNormal, color: rgb(0.3, 0.3, 0.3) });
    }
  };

  // Helper to draw Grand Total Row
  const drawGrandTotalRow = (page: PDFPage, textY: number) => {
    page.drawText("Grand Total", {
      x: 98.0,
      y: textY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const subStr = formatAmount(data.subtotal);
    page.drawText(subStr, {
      x: 350.0 - fontBold.widthOfTextAtSize(subStr, 7.5),
      y: textY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const taxStr = formatAmount(data.taxAmount);
    page.drawText(taxStr, {
      x: 401.0 - fontBold.widthOfTextAtSize(taxStr, 7.5),
      y: textY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const totalUnitsCount = data.totalUnits;
    const unitsStr = totalUnitsCount.toString();
    page.drawText(unitsStr, {
      x: 425.0 - fontBold.widthOfTextAtSize(unitsStr, 7.5) / 2,
      y: textY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const gtStr = formatAmount(data.grandTotal);
    page.drawText(gtStr, {
      x: 572.0 - fontBold.widthOfTextAtSize(gtStr, 7.5),
      y: textY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  // Helper to fill Page 1 Header Metadata, Company Details, and Client Details cleanly
  // Uses exact sub-point template coordinates to preserve 100% of pre-printed labels and lines!
  const fillT4Page1HeaderAndDetails = () => {
    // 1. Top bar: pre-printed "QUOTATION NO.: " ends at x: 138.1, y: 729.8 | "DATE: " ends at x: 482.4, y: 729.8
    // Mask only placeholder words "[NUMBER]" and "[DATE]" without touching labels!
    drawRectCover(page1, { x: 140.0, y: 724.0, width: 80.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationId), {
      x: 142.7,
      y: 729.8,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    drawRectCover(page1, { x: 485.0, y: 724.0, width: 75.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 487.0,
      y: 729.8,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // 2. Company Name: Mask only "[COMPANY NAME]" placeholder at y: 709.6
    drawRectCover(page1, { x: 42.0, y: 702.0, width: 250.0, height: 19.0 });
    page1.drawText(cleanWinAnsi(company.name || "Surya Sangam Renewable Energy Pvt Ltd"), {
      x: 44.7,
      y: 709.6,
      size: 11.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // 3. Metadata below company name at y: 699.0
    // Pre-printed "QUOTATION NO.: " is at x: 318.0 | "DATE: " is at x: 497.8
    drawRectCover(page1, { x: 370.0, y: 693.0, width: 85.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationId), {
      x: 372.6,
      y: 699.0,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    drawRectCover(page1, { x: 516.0, y: 693.0, width: 58.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 518.8,
      y: 699.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    // 4. From block: Pre-printed labels "FROM", "PHONE: ", "EMAIL: ", "GSTIN: " are 100% PRESERVED!
    // Address (y: 630.2)
    drawRectCover(page1, { x: 44.0, y: 624.0, width: 260.0, height: 13.0 });
    page1.drawText(cleanWinAnsi(company.address || "Sector 62, Electronic City, Noida, UP 201309"), {
      x: 44.7,
      y: 630.2,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.25, 0.25, 0.25),
    });
    // Phone (y: 612.0, label ends at 66.4)
    drawRectCover(page1, { x: 68.0, y: 606.0, width: 150.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(company.phone || "+91 98765 43210"), {
      x: 70.6,
      y: 612.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.25, 0.25, 0.25),
    });
    // Email (y: 590.5, label ends at 64.3)
    drawRectCover(page1, { x: 66.0, y: 584.0, width: 170.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(company.email || "info@suryasangam.com"), {
      x: 68.5,
      y: 590.5,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.25, 0.25, 0.25),
    });
    // GSTIN (y: 559.7, label ends at 67.8)
    drawRectCover(page1, { x: 70.0, y: 553.0, width: 140.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(company.gstin || "07AAAAA0000A1Z5"), {
      x: 72.0,
      y: 559.7,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.25, 0.25, 0.25),
    });

    // 5. To block: Pre-printed label "TO" at x: 555.2, y: 644.6 is PRESERVED!
    // Business Name (y: 621.0)
    drawRectCover(page1, { x: 310.0, y: 614.0, width: 266.0, height: 14.0 });
    let cName = cleanWinAnsi(data.clientName);
    while (cName.length > 3 && fontBold.widthOfTextAtSize(cName + "...", 8.0) > 240) {
      cName = cName.slice(0, -1);
    }
    if (cName !== cleanWinAnsi(data.clientName)) cName += "...";
    page1.drawText(cName, {
      x: 572.0 - fontBold.widthOfTextAtSize(cName, 8.0),
      y: 621.0,
      size: 8.0,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Customer Address (y: 603.0)
    drawRectCover(page1, { x: 310.0, y: 596.0, width: 266.0, height: 14.0 });
    let cAddr = cleanWinAnsi(data.clientAddress);
    while (cAddr.length > 3 && fontNormal.widthOfTextAtSize(cAddr + "...", 7.5) > 240) {
      cAddr = cAddr.slice(0, -1);
    }
    if (cAddr !== cleanWinAnsi(data.clientAddress)) cAddr += "...";
    page1.drawText(cAddr, {
      x: 572.0 - fontNormal.widthOfTextAtSize(cAddr, 7.5),
      y: 603.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.25, 0.25, 0.25),
    });

    // Contact Person Name (y: 581.3)
    drawRectCover(page1, { x: 310.0, y: 575.0, width: 266.0, height: 13.0 });
    if (data.contactPerson && cleanWinAnsi(data.contactPerson) !== cleanWinAnsi(data.clientName)) {
      let cPerson = cleanWinAnsi(data.contactPerson);
      while (cPerson.length > 3 && fontNormal.widthOfTextAtSize(cPerson + "...", 7.5) > 240) {
        cPerson = cPerson.slice(0, -1);
      }
      if (cPerson !== cleanWinAnsi(data.contactPerson)) cPerson += "...";
      page1.drawText(cPerson, {
        x: 572.0 - fontNormal.widthOfTextAtSize(cPerson, 7.5),
        y: 581.3,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    // Phone line (y: 572.3): Mask entire line to ensure no collision with long phone numbers
    drawRectCover(page1, { x: 310.0, y: 566.0, width: 266.0, height: 13.0 });
    if (data.clientPhone && data.clientPhone !== "N/A") {
      const fullPhone = "Phone: " + cleanWinAnsi(data.clientPhone);
      page1.drawText(fullPhone, {
        x: 572.0 - fontNormal.widthOfTextAtSize(fullPhone, 7.5),
        y: 572.3,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    // Email line (y: 550.5): Mask entire line to ensure no collision with long emails
    drawRectCover(page1, { x: 310.0, y: 544.0, width: 266.0, height: 13.0 });
    if (data.clientEmail) {
      const fullMail = "Email: " + cleanWinAnsi(data.clientEmail);
      page1.drawText(fullMail, {
        x: 572.0 - fontNormal.widthOfTextAtSize(fullMail, 7.5),
        y: 550.5,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.25, 0.25, 0.25),
      });
    }
  };

  // Populate Page 1 Header & Details
  fillT4Page1HeaderAndDetails();

  if (!isMultiPage) {
    // ---------------- SINGLE PAGE MODE (<= 3 product items) ----------------
    // Maintain the user's template directly without complex redrawing.
    // All original table lines, borders, labels, and headings are 100% PRESERVED.
    // Only placeholder text areas inside cell boundaries are masked and filled.

    // 1. ROW 1 (Product specifications: between Y = 434.5 and 463.5)
    // Mask Col 2..6 text areas cleanly inside the cell (lines are untouched)
    drawRectCover(page1, { x: 96.0, y: 436.0, width: 175.0, height: 26.5 });
    drawRectCover(page1, { x: 274.0, y: 436.0, width: 79.0, height: 26.5 });
    drawRectCover(page1, { x: 356.0, y: 436.0, width: 48.0, height: 26.5 });
    drawRectCover(page1, { x: 407.0, y: 436.0, width: 36.0, height: 26.5 });
    drawRectCover(page1, { x: 446.0, y: 436.0, width: 130.0, height: 26.5 });

    // Draw all items in Row 1 inside the same cell without adding divider lines
    if (allItems.length === 1) {
      drawT4ItemLine(page1, allItems[0], 446.0);
    } else if (allItems.length === 2) {
      drawT4ItemLine(page1, allItems[0], 452.0);
      drawT4ItemLine(page1, allItems[1], 440.0);
    } else if (allItems.length === 3) {
      drawT4ItemLine(page1, allItems[0], 454.0);
      drawT4ItemLine(page1, allItems[1], 445.0);
      drawT4ItemLine(page1, allItems[2], 437.0);
    }

    // 2. ROW 2 (pre-printed between Y = 413.5 and 434.5, baseline 420.8)
    drawRectCover(page1, { x: 274.0, y: 414.5, width: 79.0, height: 18.5 });
    drawRectCover(page1, { x: 356.0, y: 414.5, width: 48.0, height: 18.5 });
    drawRectCover(page1, { x: 407.0, y: 414.5, width: 36.0, height: 18.5 });
    drawRectCover(page1, { x: 446.0, y: 414.5, width: 130.0, height: 18.5 });
    if (row2Desc !== "Product / service and specifications") {
      drawRectCover(page1, { x: 96.0, y: 414.5, width: 175.0, height: 18.5 });
      page1.drawText(cleanWinAnsi(row2Desc), { x: 98.0, y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
    }
    if (row2Price > 0) {
      const sCost = row2Price;
      const sGst = roundToTwoDecimals((sCost * taxRate) / 100);
      const sIncl = roundToTwoDecimals(sCost + sGst);
      const sTotal = roundToTwoDecimals(row2Qty * sIncl);
      const costStr = formatAmount(sCost);
      page1.drawText(costStr, { x: 350.0 - fontNormal.widthOfTextAtSize(costStr, 7.5), y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const gstStr = formatAmount(sGst);
      page1.drawText(gstStr, { x: 401.0 - fontNormal.widthOfTextAtSize(gstStr, 7.5), y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const qStr = row2Qty.toString();
      page1.drawText(qStr, { x: 425.0 - fontNormal.widthOfTextAtSize(qStr, 7.5) / 2, y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const tStr = formatAmount(sTotal);
      page1.drawText(tStr, { x: 572.0 - fontBold.widthOfTextAtSize(tStr, 7.5), y: 420.8, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    } else {
      page1.drawText("-", { x: 345.0, y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page1.drawText("-", { x: 395.0, y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page1.drawText("-", { x: 423.0, y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      const incStr = "Included";
      page1.drawText(incStr, { x: 572.0 - fontNormal.widthOfTextAtSize(incStr, 7.5), y: 420.8, size: 7.5, font: fontNormal, color: rgb(0.3, 0.3, 0.3) });
    }

    // 3. ROW 3 (pre-printed between Y = 393.5 and 413.5, baseline 400.5)
    drawRectCover(page1, { x: 274.0, y: 394.5, width: 79.0, height: 18.0 });
    drawRectCover(page1, { x: 356.0, y: 394.5, width: 48.0, height: 18.0 });
    drawRectCover(page1, { x: 407.0, y: 394.5, width: 36.0, height: 18.0 });
    drawRectCover(page1, { x: 446.0, y: 394.5, width: 130.0, height: 18.0 });
    if (row3Desc !== "Installation / other charges, if applicable") {
      drawRectCover(page1, { x: 96.0, y: 394.5, width: 175.0, height: 18.0 });
      page1.drawText(cleanWinAnsi(row3Desc), { x: 98.0, y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
    }
    if (row3Price > 0) {
      const iCost = row3Price;
      const iGst = roundToTwoDecimals((iCost * taxRate) / 100);
      const iIncl = roundToTwoDecimals(iCost + iGst);
      const iTotal = roundToTwoDecimals(row3Qty * iIncl);
      const costStr = formatAmount(iCost);
      page1.drawText(costStr, { x: 350.0 - fontNormal.widthOfTextAtSize(costStr, 7.5), y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const gstStr = formatAmount(iGst);
      page1.drawText(gstStr, { x: 401.0 - fontNormal.widthOfTextAtSize(gstStr, 7.5), y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const qStr = row3Qty.toString();
      page1.drawText(qStr, { x: 425.0 - fontNormal.widthOfTextAtSize(qStr, 7.5) / 2, y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.1, 0.1, 0.1) });
      const tStr = formatAmount(iTotal);
      page1.drawText(tStr, { x: 572.0 - fontBold.widthOfTextAtSize(tStr, 7.5), y: 400.5, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    } else {
      page1.drawText("-", { x: 345.0, y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page1.drawText("-", { x: 395.0, y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      page1.drawText("-", { x: 423.0, y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
      const incStr = "Included";
      page1.drawText(incStr, { x: 572.0 - fontNormal.widthOfTextAtSize(incStr, 7.5), y: 400.5, size: 7.5, font: fontNormal, color: rgb(0.3, 0.3, 0.3) });
    }

    // 4. Grand Total Row (pre-printed between Y = 373.5 and 393.5, baseline 380.3)
    drawRectCover(page1, { x: 274.0, y: 374.5, width: 79.0, height: 18.0 });
    drawRectCover(page1, { x: 356.0, y: 374.5, width: 48.0, height: 18.0 });
    drawRectCover(page1, { x: 407.0, y: 374.5, width: 36.0, height: 18.0 });
    drawRectCover(page1, { x: 446.0, y: 374.5, width: 130.0, height: 18.0 });

    const subStr = formatAmount(data.subtotal);
    page1.drawText(subStr, { x: 350.0 - fontBold.widthOfTextAtSize(subStr, 7.5), y: 380.3, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    const taxStr = formatAmount(data.taxAmount);
    page1.drawText(taxStr, { x: 401.0 - fontBold.widthOfTextAtSize(taxStr, 7.5), y: 380.3, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    const unitsStr = data.totalUnits.toString();
    page1.drawText(unitsStr, { x: 425.0 - fontBold.widthOfTextAtSize(unitsStr, 7.5) / 2, y: 380.3, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    const gtStr = formatAmount(data.grandTotal);
    page1.drawText(gtStr, { x: 572.0 - fontBold.widthOfTextAtSize(gtStr, 7.5), y: 380.3, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    // 5. Total payable table values (pre-printed between Y = 279.5 and 302.5, baseline 289.5)
    drawRectCover(page1, { x: 274.0, y: 281.0, width: 78.0, height: 20.0 });
    drawRectCover(page1, { x: 356.0, y: 281.0, width: 86.0, height: 20.0 });
    drawRectCover(page1, { x: 446.0, y: 281.0, width: 70.0, height: 20.0 });

    const pSubStr = "INR " + formatAmount(data.subtotal);
    page1.drawText(pSubStr, {
      x: 350.0 - fontBold.widthOfTextAtSize(pSubStr, 8.0),
      y: 289.5,
      size: 8.0,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const pGstStr = "INR " + formatAmount(data.taxAmount);
    page1.drawText(pGstStr, {
      x: 440.0 - fontBold.widthOfTextAtSize(pGstStr, 8.0),
      y: 289.5,
      size: 8.0,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const pGtStr = "INR " + formatAmount(data.grandTotal);
    page1.drawText(pGtStr, {
      x: 514.0 - fontBold.widthOfTextAtSize(pGtStr, 8.5),
      y: 289.5,
      size: 8.5,
      font: fontBold,
      color: rgb(0.08, 0.45, 0.2),
    });

    // 6. Total in words (mask placeholder below box, baseline 271.5)
    drawRectCover(page1, { x: 270.0, y: 266.0, width: 247.0, height: 12.0 });
    const inWordsStr = cleanWinAnsi(data.totalPayableInWords);
    const inWordsW = fontOblique.widthOfTextAtSize(inWordsStr, 7.0);
    page1.drawText(inWordsStr, {
      x: 517.0 - inWordsW,
      y: 271.5,
      size: 7.0,
      font: fontOblique,
      color: rgb(0.25, 0.25, 0.25),
    });

    // 7. Date & Sign: Draw quotation date cleanly above the underline next to Date (y = 235.7)
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 112.0,
      y: 235.7,
      size: 7.6,
      font: fontNormal,
      color: rgb(0.2, 0.2, 0.2),
    });

    // 8. WARRANTY AND DELIVERY: Headings and labels are 100% original, mask ONLY placeholder words
    // Term 1 (y: 191.9, label ends at 177.9)
    drawRectCover(page1, { x: 180.0, y: 186.0, width: 395.0, height: 11.5 });
    page1.drawText(term1, { x: 182.0, y: 191.9, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // Term 2 (y: 180.6, label ends at 163.3)
    drawRectCover(page1, { x: 165.0, y: 175.0, width: 410.0, height: 11.5 });
    page1.drawText(term2, { x: 167.0, y: 180.6, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // Term 3 (y: 169.2, label ends at 131.5)
    drawRectCover(page1, { x: 133.0, y: 163.5, width: 442.0, height: 11.5 });
    page1.drawText(term3, { x: 135.0, y: 169.2, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // 9. BANK ACCOUNT DETAILS: Headings and labels are 100% original, mask ONLY placeholder words
    // Account holder (y: 128.1, label ends at 120.6)
    drawRectCover(page1, { x: 122.0, y: 122.5, width: 450.0, height: 11.5 });
    page1.drawText(cleanWinAnsi(company.accountHolder || company.name), { x: 124.0, y: 128.1, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // Bank (y: 115.7, label ends at 88.1)
    drawRectCover(page1, { x: 90.0, y: 110.0, width: 480.0, height: 11.5 });
    page1.drawText(cleanWinAnsi(company.bankName || "HDFC Bank Ltd"), { x: 92.0, y: 115.7, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // Account No. (y: 103.0, label ends at 111.3)
    drawRectCover(page1, { x: 113.0, y: 97.5, width: 460.0, height: 11.5 });
    page1.drawText(cleanWinAnsi(company.accountNumber || "50200012345678"), { x: 115.0, y: 103.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // IFSC (y: 90.2, label ends at 88.1)
    drawRectCover(page1, { x: 90.0, y: 84.5, width: 480.0, height: 11.5 });
    page1.drawText(cleanWinAnsi(company.ifscCode || "HDFC0001234"), { x: 92.0, y: 90.2, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

    // Single-page mode maintains the template provided by user directly without synthetic footer
  } else {
    // ---------------- MULTI-PAGE OVERFLOW MODE (> 3 product items) ----------------
    // Balanced pagination so neither Page 1 nor Page 2 has a large blank gap!
    function paginateT4Items(total: number): number[] {
      if (total <= 3) return [total];
      if (total <= 28) {
        // Balanced 55% / 45% split
        const p1 = Math.min(18, Math.max(Math.ceil(total * 0.55), total - 12));
        return [p1, total - p1];
      }
      const pages: number[] = [];
      const p1Cap = 18;
      pages.push(p1Cap);
      let rem = total - p1Cap;
      while (rem > 0) {
        if (rem <= 16) {
          pages.push(rem);
          break;
        }
        if (rem <= 32) {
          const mid = Math.ceil(rem / 2);
          pages.push(mid);
          pages.push(rem - mid);
          break;
        }
        pages.push(18);
        rem -= 18;
      }
      return pages;
    }

    const pageCounts = paginateT4Items(allItems.length);
    const totalPages = pageCounts.length;

    let currentIndex = 0;
    const pageChunks: (typeof allItems)[] = pageCounts.map((count) => {
      const chunk = allItems.slice(currentIndex, currentIndex + count);
      currentIndex += count;
      return chunk;
    });

    // Page 1: White out lower area below pre-printed table header down to footer
    const p1TableTopY = 463.5;
    const p1BotY = 64.0; // Extend table down to 64.0 pt to eliminate bottom gap
    drawRectCover(page1, { x: 35.0, y: 45.0, width: 545.0, height: p1TableTopY - 45.0 });

    // Header bottom horizontal line
    page1.drawLine({
      start: { x: 37.5, y: p1TableTopY },
      end: { x: 577.5, y: p1TableTopY },
      thickness: 1.0,
      color: rgb(0.1, 0.1, 0.1),
    });

    const p1Chunk = pageChunks[0];
    const availableP1Height = p1TableTopY - p1BotY; // 399.5 pt
    const p1Step = (availableP1Height - 16.0) / p1Chunk.length;

    // Page 1 Row 1: S. No. 1 and Page 1 product items in the same cell
    page1.drawText("1", {
      x: 66.0 - fontNormal.widthOfTextAtSize("1", 7.5) / 2,
      y: p1TableTopY - 12.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });

    let p1ItemY = p1TableTopY - 12.0;
    p1Chunk.forEach((item) => {
      drawT4ItemLine(page1, item, p1ItemY);
      p1ItemY -= p1Step; // NO horizontal divider lines between items in the same cell!
    });

    // Bottom border of Page 1 table (anchored at 64.0 pt directly above footer line, eliminating bottom gap)
    page1.drawLine({
      start: { x: 37.5, y: p1BotY },
      end: { x: 577.5, y: p1BotY },
      thickness: 1.0,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Outer side borders
    page1.drawLine({
      start: { x: 37.5, y: p1TableTopY },
      end: { x: 37.5, y: p1BotY },
      thickness: 1.0,
      color: rgb(0.1, 0.1, 0.1),
    });
    page1.drawLine({
      start: { x: 577.5, y: p1TableTopY },
      end: { x: 577.5, y: p1BotY },
      thickness: 1.0,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Vertical column dividers on Page 1
    const vCols = [94.5, 272.5, 354.5, 405.5, 444.5];
    vCols.forEach(x => {
      page1.drawLine({
        start: { x, y: p1TableTopY },
        end: { x, y: p1BotY },
        thickness: 0.8,
        color: rgb(0.1, 0.1, 0.1),
      });
    });

    // Page 1 Footer on multi-page
    page1.drawLine({
      start: { x: 35.0, y: 44.0 },
      end: { x: 577.5, y: 44.0 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    page1.drawText(cleanWinAnsi(company.phone) + " | " + cleanWinAnsi(company.address) + " | Email: " + cleanWinAnsi(company.email), {
      x: 37.5,
      y: 30.0,
      size: 7.0,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });
    page1.drawText("Page 1 of " + totalPages, {
      x: 525.0,
      y: 30.0,
      size: 7.5,
      font: fontNormal,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Continuation Pages (Page 2, 3, etc.)
    for (let pIdx = 1; pIdx < totalPages; pIdx++) {
      const page = pdfDoc.addPage([612.0, 792.0]);
      const chunk = pageChunks[pIdx];
      const isLast = pIdx === totalPages - 1;

      // Top divider line (NO repeated table headings as requested)
      const contTableTopY = 748.0;
      page.drawLine({
        start: { x: 37.5, y: contTableTopY },
        end: { x: 577.5, y: contTableTopY },
        thickness: 1.0,
        color: rgb(0.1, 0.1, 0.1),
      });

      if (isLast) {
        // Final continuation page: finish Row 1, then Row 2, Row 3, Grand Total, and Summary/Terms
        // Calculate dynamic heights so all content naturally spans down to Y = 64.0 pt directly above footer
        // Available vertical span: contTableTopY (748.0) down to targetIfscY = 64.0 pt
        const targetIfscY = 64.0;
        const fixedTableRowsH = 62.0; // r2 (20.0) + r3 (20.0) + gt (22.0)
        // Fixed offsets: box (50.0) + words (14.0) + warranty (42.0) + bank (56.0) = 162.0 pt.
        // Total fixed vertical consumption: 62.0 + 162.0 = 224.0 pt.
        // Net vertical span available for (chunk.length * contStep + 4 * gap):
        // netSpan = 748.0 - 224.0 - targetIfscY = 460.0 pt.
        const netSpan = contTableTopY - 224.0 - targetIfscY; // Exactly 460.0 pt
        const idealStep = Math.min(26.0, Math.max(16.0, (netSpan - 4 * 24.0) / chunk.length));
        const contStep = idealStep;
        const itemsH = chunk.length * contStep;
        const gtBotY = contTableTopY - (itemsH + fixedTableRowsH);

        let contItemY = contTableTopY - 12.0;
        chunk.forEach((item) => {
          drawT4ItemLine(page, item, contItemY);
          contItemY -= contStep; // NO horizontal lines between items in the same cell!
        });

        const contItemsBotY = gtBotY + fixedTableRowsH;

        // Horizontal divider after Row 1
        page.drawLine({
          start: { x: 37.5, y: contItemsBotY },
          end: { x: 577.5, y: contItemsBotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });

        // ROW 2: S. No. 2: "Product / service and specifications"
        const r2BotY = contItemsBotY - 20.0;
        drawRow2(page, contItemsBotY - 13.0);
        page.drawLine({
          start: { x: 37.5, y: r2BotY },
          end: { x: 577.5, y: r2BotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });

        // ROW 3: S. No. 3: "Installation / other charges, if applicable"
        const r3BotY = r2BotY - 20.0;
        drawRow3(page, r2BotY - 13.0);
        page.drawLine({
          start: { x: 37.5, y: r3BotY },
          end: { x: 577.5, y: r3BotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });

        // ROW 4: Grand Total Row
        drawGrandTotalRow(page, r3BotY - 14.0);
        page.drawLine({
          start: { x: 37.5, y: gtBotY },
          end: { x: 577.5, y: gtBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Outer side borders
        page.drawLine({
          start: { x: 37.5, y: contTableTopY },
          end: { x: 37.5, y: gtBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: 577.5, y: contTableTopY },
          end: { x: 577.5, y: gtBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Vertical column dividers
        vCols.forEach(x => {
          const bot = x === 94.5 ? r3BotY : gtBotY;
          page.drawLine({
            start: { x, y: contTableTopY },
            end: { x, y: bot },
            thickness: 0.8,
            color: rgb(0.1, 0.1, 0.1),
          });
        });

        // Dynamic spacing so BANK ACCOUNT DETAILS finishes cleanly right at targetIfscY = 64.0 pt above footer!
        // This mathematically eliminates any large dead space at the bottom of Page 2!
        const gap = (netSpan - itemsH) / 4;

        const boxTopY = gtBotY - gap;
        const tLeft = 272.5;
        const tRight = 577.5;
        const d1 = 354.5;
        const d2 = 444.5;
        const rowMidY = boxTopY - 24.0;
        const rowBotY = boxTopY - 50.0;

        // "Total payable:" 3 boxes
        page.drawRectangle({
          x: tLeft,
          y: rowBotY,
          width: tRight - tLeft,
          height: 50.0,
          borderColor: rgb(0.1, 0.1, 0.1),
          borderWidth: 1.0,
        });
        page.drawLine({ start: { x: tLeft, y: rowMidY }, end: { x: tRight, y: rowMidY }, thickness: 1.0, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: d1, y: boxTopY }, end: { x: d1, y: rowBotY }, thickness: 1.0, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: d2, y: boxTopY }, end: { x: d2, y: rowBotY }, thickness: 1.0, color: rgb(0.1, 0.1, 0.1) });

        page.drawText("Subtotal before GST", { x: tLeft + 6.0, y: boxTopY - 15.0, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("GST amount", { x: d1 + 14.0, y: boxTopY - 15.0, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Final amount including GST", { x: d2 + 6.0, y: boxTopY - 15.0, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

        const contSubStr = "INR " + formatAmount(data.subtotal);
        page.drawText(contSubStr, { x: d1 - 8.0 - fontBold.widthOfTextAtSize(contSubStr, 8.0), y: rowMidY - 17.0, size: 8.0, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        const contGstStr = "INR " + formatAmount(data.taxAmount);
        page.drawText(contGstStr, { x: d2 - 8.0 - fontBold.widthOfTextAtSize(contGstStr, 8.0), y: rowMidY - 17.0, size: 8.0, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        const contGtStr = "INR " + formatAmount(data.grandTotal);
        page.drawText(contGtStr, { x: tRight - 8.0 - fontBold.widthOfTextAtSize(contGtStr, 8.5), y: rowMidY - 17.0, size: 8.5, font: fontBold, color: rgb(0.08, 0.45, 0.2) });

        // Amount in words
        const wordsY = rowBotY - 14.0;
        const contInWords = cleanWinAnsi(data.totalPayableInWords);
        const contInWordsW = fontOblique.widthOfTextAtSize(contInWords, 7.0);
        page.drawText(contInWords, { x: tRight - contInWordsW, y: wordsY, size: 7.0, font: fontOblique, color: rgb(0.25, 0.25, 0.25) });

        // Date & sign
        const signY = wordsY - gap;
        page.drawText("Date & sign", { x: 37.5, y: signY, size: 7.6, font: fontNormal, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(cleanWinAnsi(data.quotationDate), { x: 105.0, y: signY, size: 7.6, font: fontNormal, color: rgb(0.2, 0.2, 0.2) });

        // WARRANTY AND DELIVERY
        const wTopY = signY - gap;
        page.drawText("WARRANTY AND DELIVERY", { x: 37.5, y: wTopY, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Warranty coverage and duration: " + term1, { x: 37.5, y: wTopY - 14.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Delivery / installation period: " + term2, { x: 37.5, y: wTopY - 28.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Quotation valid for: " + term3, { x: 37.5, y: wTopY - 42.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });

        // BANK ACCOUNT DETAILS (finishes right at targetIfscY = 64.0 pt directly above footer line at 44.0 pt)
        const bTopY = (wTopY - 42.0) - gap;
        page.drawText("BANK ACCOUNT DETAILS", { x: 37.5, y: bTopY, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Account holder: " + cleanWinAnsi(company.accountHolder || company.name), { x: 37.5, y: bTopY - 14.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Bank: " + cleanWinAnsi(company.bankName || "HDFC Bank Ltd"), { x: 37.5, y: bTopY - 28.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Account No.: " + cleanWinAnsi(company.accountNumber || "50200012345678"), { x: 37.5, y: bTopY - 42.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("IFSC: " + cleanWinAnsi(company.ifscCode || "HDFC0001234"), { x: 37.5, y: bTopY - 56.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
      } else {
        // Intermediate continuation page: full table down to 64.0 pt
        const interTargetBotY = 64.0;
        const availableInterH = contTableTopY - interTargetBotY;
        const interStep = (availableInterH - 16.0) / chunk.length;
        const contItemsBotY = interTargetBotY;

        let contItemY = contTableTopY - 12.0;
        chunk.forEach((item) => {
          drawT4ItemLine(page, item, contItemY);
          contItemY -= interStep;
        });

        page.drawLine({
          start: { x: 37.5, y: contItemsBotY },
          end: { x: 577.5, y: contItemsBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: 37.5, y: contTableTopY },
          end: { x: 37.5, y: contItemsBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: 577.5, y: contTableTopY },
          end: { x: 577.5, y: contItemsBotY },
          thickness: 1.0,
          color: rgb(0.1, 0.1, 0.1),
        });
        vCols.forEach(x => {
          page.drawLine({
            start: { x, y: contTableTopY },
            end: { x, y: contItemsBotY },
            thickness: 0.8,
            color: rgb(0.1, 0.1, 0.1),
          });
        });
      }

      // Continuation Page Footer
      page.drawLine({
        start: { x: 35.0, y: 44.0 },
        end: { x: 577.5, y: 44.0 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      page.drawText(cleanWinAnsi(company.phone) + " | " + cleanWinAnsi(company.address) + " | Email: " + cleanWinAnsi(company.email), {
        x: 37.5,
        y: 30.0,
        size: 7.0,
        font: fontNormal,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText("Page " + (pIdx + 1) + " of " + totalPages, {
        x: 525.0,
        y: 30.0,
        size: 7.5,
        font: fontNormal,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const savedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(savedPdfBytes);
}

export async function fillQuotationPdfTemplate(
  data: CalculatedQuotationData,
  templateId: string = "t2"
): Promise<Buffer> {
  // Normalize templateId strictly to user-provided templates
  const normalizedId = templateId === "t4" ? "t4" : templateId === "t3" ? "t3" : "t2";
  const config = resolveTemplateConfig(normalizedId);

  const safeFilename = path.basename(config.fileName);
  const candidateDirs = [
    path.join(__dirname, "../../templates"),
    path.join(__dirname, "../templates"),
    path.join(process.cwd(), "templates"),
    path.join(process.cwd(), "backend/templates"),
  ];

  let templatePath = "";
  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, safeFilename);
    if (fs.existsSync(fullPath)) {
      templatePath = fullPath;
      break;
    }
  }

  if (!templatePath) {
    throw new Error(
      `Template PDF file "${safeFilename}" for templateId "${normalizedId}" not found on server.`
    );
  }

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  if (normalizedId === "t4") {
    return await fillT4Template(pdfDoc, config, data);
  } else if (normalizedId === "t3") {
    return await fillT3Template(pdfDoc, config, data);
  } else {
    return await fillT2Template(pdfDoc, config, data);
  }
}
