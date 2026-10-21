const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { calculateQuotation } = require('./dist/services/calculation.service');
const { fillQuotationPdfTemplate } = require('./dist/services/pdfLibFiller.service');

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

async function testCounts() {
  const counts = [1, 3, 5, 12, 25];
  for (const c of counts) {
    const q = makeQuotation(`QT-T4-${c}`, c);
    const calc = calculateQuotation(q);
    const pdfBuf = await fillQuotationPdfTemplate(calc, 't4');
    const outFile = `test_output/t4_${c}items.pdf`;
    fs.writeFileSync(outFile, pdfBuf);
    console.log(`Generated ${outFile} for ${c} items`);
  }

  // Render previews for 5 items (p1 and p2) and 12 items (p1 and p2)
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const renderTargets = [
    { file: 'test_output/t4_5items.pdf', page: 1, out: 'test_output/t4_5items_page1.png' },
    { file: 'test_output/t4_5items.pdf', page: 2, out: 'test_output/t4_5items_page2.png' },
    { file: 'test_output/t4_12items.pdf', page: 1, out: 'test_output/t4_12items_page1.png' },
    { file: 'test_output/t4_12items.pdf', page: 2, out: 'test_output/t4_12items_page2.png' },
  ];

  for (const t of renderTargets) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1.0 });
    const absPath = path.resolve(t.file);
    const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${t.page}&toolbar=0&navpanes=0&view=Fit`;
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: t.out });
    console.log(`Rendered: ${t.out}`);
    await page.close();
  }

  await browser.close();
  console.log('All test counts completed successfully.');
}

testCounts().catch(console.error);
