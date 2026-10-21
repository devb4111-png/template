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

async function runVisualVerification() {
  const outputDir = path.resolve(__dirname, 'test_output/visual_verify');
  fs.mkdirSync(outputDir, { recursive: true });

  const templatesToTest = [
    { templateId: 't2', name: 't2_canva' },
    { templateId: 't3', name: 't3_solar_spec' },
    { templateId: 't2-html', name: 't2_html_engine' },
  ];

  const q25 = makeQuotation('QT-2026-MULTI-25', 25);

  const pdfFiles = [];

  for (const t of templatesToTest) {
    console.log(`Generating 25-item PDF for template "${t.templateId}"...`);
    const res = await postJson('/api/generate-pdf', {
      templateId: t.templateId,
      quotation: q25,
    });

    if (res.statusCode !== 200) {
      console.error(`Error generating ${t.templateId}:`, res.buffer.toString('utf-8'));
      continue;
    }

    const pdfDoc = await PDFDocument.load(res.buffer);
    const pageCount = pdfDoc.getPageCount();
    const pdfPath = path.join(outputDir, `${t.name}_25items.pdf`);
    fs.writeFileSync(pdfPath, res.buffer);
    console.log(`Saved ${pdfPath} (${pageCount} pages)`);

    pdfFiles.push({ name: t.name, pdfPath, pageCount });
  }

  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const f of pdfFiles) {
    for (let p = 1; p <= f.pageCount; p++) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 1900, deviceScaleFactor: 1.0 });
      const url = 'file:///' + f.pdfPath.replace(/\\/g, '/') + `#page=${p}&toolbar=0&navpanes=0&view=Fit`;
      await page.goto(url, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 2000));
      const screenshotPath = path.join(outputDir, `${f.name}_p${p}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved: ${screenshotPath}`);
      await page.close();
    }
  }

  await browser.close();
  console.log('\nAll visual verification screenshots generated successfully!');
}

runVisualVerification().catch(console.error);
