const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');

const BASE_URL = 'http://localhost:5000';

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            buffer,
          });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function makeQuotation(id, numItems) {
  const items = [];
  for (let i = 1; i <= numItems; i++) {
    items.push({
      itemName: `Solar Photovoltaic High Efficiency Module Grade-A Model ${i}00W`,
      quantity: i,
      unitPrice: 1200 + i * 150,
    });
  }
  return {
    quotationId: id,
    quotationDate: '2026-10-21',
    clientName: 'Zenith Renewable Energy Solutions Ltd',
    clientAddress: 'Industrial Complex 4B, Sector 62, Noida, Uttar Pradesh 201309',
    clientEmail: 'procurement@zenithsolar.in',
    clientPhone: '+91 98765 11223',
    contactPerson: 'Mr. Rajesh Sharma',
    companyDetails: {
      name: 'Surya Sangam Renewable Energy Pvt Ltd',
      address: 'Sector 62, Electronic City, Noida, UP 201309',
      phone: '+91 98765 43210',
      email: 'info@suryasangam.com',
      gstin: '07AAAAA0000A1Z5',
      website: 'www.suryasangam.com',
      bankName: 'HDFC Bank Ltd',
      accountHolder: 'Surya Sangam Renewable Energy Pvt Ltd',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0001234',
      branch: 'Noida Sector 62 Branch',
    },
    items,
    taxRate: 18,
    terms: [
      'Quotation validity is 30 days from issue date.',
      'Payment terms: 50% advance, 40% on delivery, 10% post-commissioning.',
      'Comprehensive 5-year onsite warranty included.',
      'Prices are inclusive of standard transport up to 50 km.',
      'Grid approval and net-metering liaison support provided.',
    ],
  };
}

async function run() {
  fs.mkdirSync('test_output/direct_previews', { recursive: true });

  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testCases = [
    { id: 'QT-HTML-SINGLE', count: 2, label: 'single' },
    { id: 'QT-HTML-24', count: 24, label: '24items' },
    { id: 'QT-HTML-25', count: 25, label: '25items' },
  ];

  for (const tc of testCases) {
    console.log(`\n=== Testing ${tc.label} (${tc.count} items) ===`);
    const q = makeQuotation(tc.id, tc.count);
    const res = await postJson('/api/generate-pdf', {
      templateId: 't2-html',
      quotation: q,
    });
    console.log(`PDF Status: ${res.statusCode}, size: ${res.buffer.length}`);
    const pdfDoc = await PDFDocument.load(res.buffer);
    const pageCount = pdfDoc.getPageCount();
    console.log(`PDF Page Count: ${pageCount}`);

    // Now let's inspect the rendered HTML directly in Puppeteer to capture exact page elements
    // We can fetch preview or generate HTML
    const { generateQuotationHtml } = require('./dist/services/pdf.service');
    const { calculateQuotation } = require('./dist/services/calculation.service');
    const calculated = calculateQuotation(q);
    const html = generateQuotationHtml(calculated);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 2000, deviceScaleFactor: 2.0 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Check page heights and overflow
    const metrics = await page.evaluate(() => {
      const pageEls = document.querySelectorAll('.page');
      return Array.from(pageEls).map((el, i) => ({
        page: i + 1,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        isOverflown: el.scrollHeight > el.clientHeight
      }));
    });
    console.log(`Page metrics for ${tc.label}:`, metrics);

    // Screenshot each .page element individually!
    const pageEls = await page.$$('.page');
    for (let i = 0; i < pageEls.length; i++) {
      const outPath = `test_output/direct_previews/${tc.label}_p${i + 1}.png`;
      await pageEls[i].screenshot({ path: outPath });
      console.log(`Saved element screenshot: ${outPath}`);
    }
    await page.close();
  }

  await browser.close();
  console.log('\nAll direct page element screenshots captured successfully!');
}

run().catch(console.error);
