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
            json: () => {
              try {
                return JSON.parse(buffer.toString('utf-8'));
              } catch (e) {
                return null;
              }
            },
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
  console.log('Testing Surya Sangam HTML Engine (t2-html)...');
  fs.mkdirSync('test_output/html_previews', { recursive: true });

  // 1. Single page test (2 items)
  console.log('\n--- 1. Single Page Test (2 items) ---');
  const qSingle = makeQuotation('QT-HTML-SINGLE', 2);
  const resSingle = await postJson('/api/generate-pdf', {
    templateId: 't2-html',
    quotation: qSingle,
  });
  console.log('Status:', resSingle.statusCode);
  const pdfSingle = await PDFDocument.load(resSingle.buffer);
  console.log('Page count:', pdfSingle.getPageCount());
  fs.writeFileSync('test_output/t2_html_single.pdf', resSingle.buffer);

  // 2. Multi page test (24 items)
  console.log('\n--- 2. Multi Page Test (24 items) ---');
  const q24 = makeQuotation('QT-HTML-24', 24);
  const res24 = await postJson('/api/generate-pdf', {
    templateId: 't2-html',
    quotation: q24,
  });
  console.log('Status:', res24.statusCode);
  const pdf24 = await PDFDocument.load(res24.buffer);
  console.log('Page count:', pdf24.getPageCount());
  fs.writeFileSync('test_output/t2_html_24.pdf', res24.buffer);

  // 3. Multi page test (25 items)
  console.log('\n--- 3. Multi Page Test (25 items) ---');
  const q25 = makeQuotation('QT-HTML-25', 25);
  const res25 = await postJson('/api/generate-pdf', {
    templateId: 't2-html',
    quotation: q25,
  });
  console.log('Status:', res25.statusCode);
  const pdf25 = await PDFDocument.load(res25.buffer);
  console.log('Page count:', pdf25.getPageCount());
  fs.writeFileSync('test_output/t2_html_25.pdf', res25.buffer);

  // Render screenshots of each page using pdf-to-image or Edge PDF viewer
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pdfsToRender = [
    { file: 'test_output/t2_html_single.pdf', pages: pdfSingle.getPageCount(), prefix: 'single' },
    { file: 'test_output/t2_html_24.pdf', pages: pdf24.getPageCount(), prefix: '24items' },
    { file: 'test_output/t2_html_25.pdf', pages: pdf25.getPageCount(), prefix: '25items' },
  ];

  for (const item of pdfsToRender) {
    const absPath = path.resolve(item.file);
    for (let p = 1; p <= item.pages; p++) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.0 });
      // Use Edge PDF viewer with specific page
      const fileUrl = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${p}&view=FitH`;
      await page.goto(fileUrl, { waitUntil: 'load' });
      await new Promise((r) => setTimeout(r, 2000));
      const outPath = `test_output/html_previews/${item.prefix}_page${p}.png`;
      await page.screenshot({ path: outPath });
      console.log(`Rendered: ${outPath}`);
      await page.close();
    }
  }

  await browser.close();
  console.log('All tests & screenshots completed successfully!');
}

run().catch(console.error);
