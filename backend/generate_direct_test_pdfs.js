const fs = require('fs');
const path = require('path');
const { calculateQuotation } = require('./dist/services/calculation.service');
const { fillQuotationPdfTemplate } = require('./dist/services/pdfLibFiller.service');
const { PDF_TEMPLATES_CONFIG } = require('./dist/config/pdfMap.config');

function makeQuotation(id, numItems) {
  const items = [];
  for (let i = 1; i <= numItems; i++) {
    items.push({
      itemName: `Solar Photovoltaic Module Grade-A Model ${i}00W Mono-PERC High Efficiency`,
      quantity: i,
      unitPrice: 1500 + i * 100,
    });
  }
  return {
    quotationId: id,
    quotationDate: '2026-10-21',
    clientName: 'Zenith Renewable Energy Solutions Ltd',
    clientAddress: 'Industrial Complex 4B, Sector 62, Noida, Uttar Pradesh 201309',
    clientEmail: 'procurement@zenithsolar.in',
    clientPhone: '+91 98111 22334',
    contactPerson: 'Mr. Rajesh Verma',
    items,
    taxRate: 18,
    terms: [
      '30 Days from quotation date',
      '50% advance, 40% on delivery, 10% post-commissioning.',
      'Comprehensive 5-year onsite warranty included.',
    ],
  };
}

async function run() {
  fs.mkdirSync('test_output', { recursive: true });

  const qSingle = makeQuotation('QT-2026-T4-01', 2);
  const q25 = makeQuotation('QT-2026-MULTI-25', 25);

  const calcSingle = calculateQuotation(qSingle);
  const calc25 = calculateQuotation(q25);

  // Generate T4 Single
  const t4SingleBuf = await fillQuotationPdfTemplate(calcSingle, "t4");
  fs.writeFileSync('test_output/t4_single.pdf', t4SingleBuf);
  console.log('Generated test_output/t4_single.pdf');

  // Generate T4 25 Items
  const t4MultiBuf = await fillQuotationPdfTemplate(calc25, "t4");
  fs.writeFileSync('test_output/t4_25_items.pdf', t4MultiBuf);
  console.log('Generated test_output/t4_25_items.pdf');

  // Generate T3 Single & 25
  const t3SingleBuf = await fillQuotationPdfTemplate(calcSingle, "t3");
  fs.writeFileSync('test_output/t3_single.pdf', t3SingleBuf);
  const t3MultiBuf = await fillQuotationPdfTemplate(calc25, "t3");
  fs.writeFileSync('test_output/t3_25_items.pdf', t3MultiBuf);
  console.log('Generated test_output/t3_single.pdf and t3_25_items.pdf');

  // Generate T2 Single & 25
  const t2SingleBuf = await fillQuotationPdfTemplate(calcSingle, "t2");
  fs.writeFileSync('test_output/t2_single.pdf', t2SingleBuf);
  const t2MultiBuf = await fillQuotationPdfTemplate(calc25, "t2");
  fs.writeFileSync('test_output/t2_25_items.pdf', t2MultiBuf);
  console.log('Generated test_output/t2_single.pdf and t2_25_items.pdf');

  console.log('All direct test PDFs generated successfully!');
}

run().catch(console.error);
