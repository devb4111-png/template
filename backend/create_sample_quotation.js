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

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.get(url, (res) => {
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
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('=== Creating Sample Quotation with 20 Entries ===');

  const quotation20Items = [
    { itemName: 'Mono-PERC 545W Bifacial Solar PV Modules', quantity: 40, unitPrice: 12500.00 },
    { itemName: '50kW On-Grid 3-Phase Solar String Inverter', quantity: 1, unitPrice: 145000.00 },
    { itemName: 'MPPT Charge Controller 60A 150V DC', quantity: 2, unitPrice: 16500.00 },
    { itemName: 'Lithium Ferro Phosphate (LiFePO4) 48V 100Ah Battery', quantity: 4, unitPrice: 68000.00 },
    { itemName: 'HDG Elevated Solar Module Mounting Structure (2P)', quantity: 20, unitPrice: 4200.00 },
    { itemName: '4 Sq.mm Solar DC Cable UV Resistant (Red/Black 500m)', quantity: 2, unitPrice: 18500.00 },
    { itemName: '16 Sq.mm 4-Core Copper Armoured AC Cable (100m)', quantity: 1, unitPrice: 32000.00 },
    { itemName: 'Solar Array Junction Box (AJB / DCDB 4-In-4-Out)', quantity: 2, unitPrice: 8500.00 },
    { itemName: '3-Phase AC Distribution Box (ACDB) with SPD & MCB', quantity: 1, unitPrice: 14200.00 },
    { itemName: 'Copper Bonded Chemical Earthing Electrode 17.2mm x 3m', quantity: 6, unitPrice: 3400.00 },
    { itemName: 'BFC Low-Resistance Earthing Chemical Compound (25kg)', quantity: 6, unitPrice: 1250.00 },
    { itemName: 'ESE Early Streamer Emission Lightning Arrester 60us', quantity: 1, unitPrice: 28000.00 },
    { itemName: 'Bi-Directional Net Meter 3-Phase 4-Wire LTCT Compliant', quantity: 1, unitPrice: 19500.00 },
    { itemName: 'Solar IoT Data Logger & Remote Monitoring Gateway', quantity: 1, unitPrice: 11200.00 },
    { itemName: 'Weather Sensor Station (Pyranometer, Temp & Wind)', quantity: 1, unitPrice: 34500.00 },
    { itemName: 'MC4 IP68 Solar Connectors 1000V DC (Pack of 50 pairs)', quantity: 2, unitPrice: 3200.00 },
    { itemName: 'GI Perforated Cable Trays 150mm x 50mm with Covers (3m)', quantity: 15, unitPrice: 1450.00 },
    { itemName: 'Fire Extinguisher ABC Type 6kg & Sand Bucket Stand', quantity: 2, unitPrice: 3800.00 },
    { itemName: 'Solar Safety Signages, Hazard Markings & Danger Plates', quantity: 1, unitPrice: 2500.00 },
    { itemName: 'Class-0 Insulated Rubber Electrical Hand Gloves & Mat', quantity: 2, unitPrice: 1800.00 },
  ];

  const quotationData = {
    quotationId: 'QT-2026-SOLAR-20',
    quotationDate: '2026-10-22',
    clientName: 'Apex Green Horizons Infrastructure Ltd',
    clientAddress: 'Plot 72, Sector 18, Udyog Vihar Phase IV, Gurugram, Haryana 122015',
    clientEmail: 'projects@apexgreenhorizons.com',
    clientPhone: '+91 98112 34567',
    contactPerson: 'Er. Rajesh Varma (Project Director)',
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
      branch: 'Sector 62 Noida',
    },
    items: quotation20Items,
    row2Description: 'Comprehensive Testing, Pre-Commissioning & Grid Synchronisation',
    row2UnitPrice: 45000.00,
    row2Quantity: 1,
    row3Description: 'Turnkey Civil Foundation, Installation & Commissioning Charges',
    row3UnitPrice: 85000.00,
    row3Quantity: 1,
    taxRate: 18,
    terms: [
      'Quotation validity: 30 Days from quotation date',
      'Warranty coverage: 5 Years Comprehensive Onsite System Warranty',
      'Delivery period: 3-4 Weeks after Advance Purchase Order',
    ],
    templateId: 't4',
  };

  fs.mkdirSync('test_output', { recursive: true });

  // 1. Save quotation in Database via POST /api/quotations
  console.log('\n1. Saving quotation to database via POST /api/quotations...');
  // Check if already exists; if so, delete or ignore
  const saveRes = await postJson('/api/quotations', quotationData);
  console.log('Database Save Response Status:', saveRes.statusCode);
  if (saveRes.statusCode === 201) {
    console.log('✅ Quotation saved successfully to database!');
  } else if (saveRes.statusCode === 409) {
    console.log('ℹ️ Quotation already exists in database (HTTP 409). Proceeding to generate PDF.');
  } else {
    console.error('❌ Save error:', saveRes.buffer.toString('utf-8'));
  }

  // 2. Generate PDF via POST /api/quotations/generate-pdf with template t4
  console.log('\n2. Generating PDF using template t4 via POST /api/quotations/generate-pdf...');
  const pdfRes = await postJson('/api/quotations/generate-pdf', {
    templateId: 't4',
    quotation: quotationData,
  });

  console.log('PDF Generation Response Status:', pdfRes.statusCode);
  if (pdfRes.statusCode !== 200) {
    console.error('❌ Failed to generate PDF:', pdfRes.buffer.toString('utf-8'));
    process.exit(1);
  }

  const pdfPath = path.join(__dirname, 'test_output', 'sample_quotation_20_entries.pdf');
  fs.writeFileSync(pdfPath, pdfRes.buffer);
  console.log(`✅ Saved generated PDF (${pdfRes.buffer.length} bytes) to: ${pdfPath}`);

  // Inspect pages
  const loadedPdf = await PDFDocument.load(pdfRes.buffer);
  const pageCount = loadedPdf.getPageCount();
  console.log(`Total Pages generated: ${pageCount}`);

  // 3. Render PDF pages as high-resolution PNG using Edge
  console.log('\n3. Rendering PDF pages to PNG using Edge...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (let i = 1; i <= pageCount; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1.0 });
    const absPath = path.resolve(pdfPath);
    const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${i}&toolbar=0&navpanes=0&view=Fit`;
    await page.goto(url, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 1500));
    const outPngPath = path.join(__dirname, 'test_output', `sample_quotation_20_p${i}.png`);
    await page.screenshot({ path: outPngPath });
    console.log(`✅ Rendered Page ${i} screenshot to: ${outPngPath}`);
    await page.close();
  }

  await browser.close();

  // 4. Verify fetch from database
  console.log('\n4. Verifying quotation in database...');
  const getRes = await getJson(`/api/quotations/${quotationData.quotationId}`);
  if (getRes.statusCode === 200) {
    const q = getRes.json().quotation;
    console.log(`✅ Quotation found in database: ID=${q.quotationId}, Subtotal=INR ${q.subtotal.toLocaleString('en-IN')}, Tax=INR ${q.taxAmount.toLocaleString('en-IN')}, Grand Total=INR ${q.grandTotal.toLocaleString('en-IN')}`);
    console.log(`Total items count in DB: ${q.items.length}`);
  } else {
    console.error('❌ Quotation not found in database:', getRes.statusCode);
  }

  console.log('\n=== COMPLETED SUCCESSFULLY ===');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
