const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/services/pdfLibFiller.service.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const t4StartMark = 'async function fillT4Template(';
const t4EndMark = 'export async function fillQuotationPdfTemplate(';

const t4StartIndex = content.indexOf(t4StartMark);
const t4EndIndex = content.indexOf(t4EndMark);

if (t4StartIndex === -1 || t4EndIndex === -1) {
  console.error('Could not find markers for fillT4Template');
  process.exit(1);
}

const newFillT4 = `async function fillT4Template(
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
    drawRectCover(page1, { x: 139.5, y: 724.0, width: 80.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationId), {
      x: 141.0,
      y: 729.8,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    drawRectCover(page1, { x: 485.0, y: 724.0, width: 75.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 488.0,
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
      x: 373.0,
      y: 699.0,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    drawRectCover(page1, { x: 517.0, y: 693.0, width: 58.0, height: 12.0 });
    page1.drawText(cleanWinAnsi(data.quotationDate), {
      x: 520.0,
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
    drawRectCover(page1, { x: 67.0, y: 584.0, width: 170.0, height: 12.0 });
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
    drawRectCover(page1, { x: 350.0, y: 615.0, width: 226.0, height: 13.0 });
    let cName = cleanWinAnsi(data.clientName);
    while (cName.length > 3 && fontBold.widthOfTextAtSize(cName + "...", 8.0) > 200) {
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
    drawRectCover(page1, { x: 350.0, y: 597.0, width: 226.0, height: 13.0 });
    let cAddr = cleanWinAnsi(data.clientAddress);
    while (cAddr.length > 3 && fontNormal.widthOfTextAtSize(cAddr + "...", 7.5) > 200) {
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
    drawRectCover(page1, { x: 350.0, y: 575.0, width: 226.0, height: 13.0 });
    if (data.contactPerson && cleanWinAnsi(data.contactPerson) !== cleanWinAnsi(data.clientName)) {
      let cPerson = cleanWinAnsi(data.contactPerson);
      while (cPerson.length > 3 && fontNormal.widthOfTextAtSize(cPerson + "...", 7.5) > 200) {
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
    drawRectCover(page1, { x: 450.0, y: 566.0, width: 126.0, height: 12.0 });
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
    drawRectCover(page1, { x: 450.0, y: 544.0, width: 126.0, height: 12.0 });
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
    const p1BotY = 70.0; // Extend table all the way down to 70.0 pt to completely eliminate dead space
    drawRectCover(page1, { x: 35.0, y: 45.0, width: 545.0, height: p1TableTopY - 45.0 });

    // Header bottom horizontal line
    page1.drawLine({
      start: { x: 37.5, y: p1TableTopY },
      end: { x: 577.5, y: p1TableTopY },
      thickness: 1.0,
      color: rgb(0.1, 0.1, 0.1),
    });

    const p1Chunk = pageChunks[0];
    const availableP1Height = p1TableTopY - p1BotY; // 393.5 pt
    const p1Step = Math.min(26.0, Math.max(14.0, (availableP1Height - 16.0) / p1Chunk.length));

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

    // Bottom border of Page 1 table (anchored at 70.0 pt directly above footer line, eliminating bottom gap)
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
        // Calculate dynamic heights so all content naturally spans down to Y ~ 68 pt directly above footer
        // Available vertical span: 748.0 down to targetIfscY = 68.0 pt (680.0 pt total)
        const targetIfscY = 68.0;
        const totalContentH = 50.0 + 14.0 + 16.0 + 14.0 + 42.0 + 14.0 + 56.0; // 206.0 pt fixed content below table
        const r2Height = 20.0;
        const r3Height = 20.0;
        const gtHeight = 22.0;
        const fixedTableRowsH = r2Height + r3Height + gtHeight; // 62.0 pt

        // Generously proportioned item step (20 to 26 pt per row)
        const contStep = Math.min(26.0, Math.max(18.0, (680.0 - totalContentH - fixedTableRowsH - 120.0) / chunk.length));
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
        const r2BotY = contItemsBotY - r2Height;
        drawRow2(page, contItemsBotY - 13.0);
        page.drawLine({
          start: { x: 37.5, y: r2BotY },
          end: { x: 577.5, y: r2BotY },
          thickness: 0.8,
          color: rgb(0.1, 0.1, 0.1),
        });

        // ROW 3: S. No. 3: "Installation / other charges, if applicable"
        const r3BotY = r2BotY - r3Height;
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

        // Dynamic spacing so BANK ACCOUNT DETAILS finishes cleanly right at targetIfscY = 68 pt above footer!
        // This mathematically eliminates any large dead space at the bottom of Page 2!
        const spaceBelowTable = gtBotY - targetIfscY;
        const gap = Math.max(16.0, (spaceBelowTable - totalContentH) / 4);

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

        // BANK ACCOUNT DETAILS (finishes right at targetIfscY = 68 pt above footer line 44 pt)
        const bTopY = (wTopY - 42.0) - gap;
        page.drawText("BANK ACCOUNT DETAILS", { x: 37.5, y: bTopY, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Account holder: " + cleanWinAnsi(company.accountHolder || company.name), { x: 37.5, y: bTopY - 14.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Bank: " + cleanWinAnsi(company.bankName || "HDFC Bank Ltd"), { x: 37.5, y: bTopY - 28.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("Account No.: " + cleanWinAnsi(company.accountNumber || "50200012345678"), { x: 37.5, y: bTopY - 42.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
        page.drawText("IFSC: " + cleanWinAnsi(company.ifscCode || "HDFC0001234"), { x: 37.5, y: bTopY - 56.0, size: 7.5, font: fontNormal, color: rgb(0.25, 0.25, 0.25) });
      } else {
        // Intermediate continuation page: full table down to 70.0
        const interTargetBotY = 70.0;
        const availableInterH = contTableTopY - interTargetBotY;
        const interStep = Math.min(22.0, Math.max(14.0, (availableInterH - 16.0) / chunk.length));
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

`;

content = content.slice(0, t4StartIndex) + newFillT4 + content.slice(t4EndIndex);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated pdfLibFiller.service.ts with exact sub-point template coordinates and zero bottom gaps!');
