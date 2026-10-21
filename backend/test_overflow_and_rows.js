const fs = require('fs');
const http = require('http');

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'http://localhost:5000');
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

async function run() {
  console.log('--- Testing Zero Overflow and Dynamic Row Sizing ---');

  if (!fs.existsSync('test_output')) {
    fs.mkdirSync('test_output');
  }

  // 1. Single-page mode with 5 items (previously would overflow over Row 2 line)
  const t4FiveItems = {
    templateId: 't4',
    quotationId: 'QT-2026-T4-5ITEMS',
    quotationDate: '2026-10-21',
    clientName: 'Apex Solar Utilities Pvt Ltd',
    clientAddress: 'Plot 45, Phase II, Industrial Area, Gurugram, Haryana 122015',
    clientEmail: 'billing@apexsolar.in',
    clientPhone: '+91 98111 22233',
    contactPerson: 'Mr. Rajesh Khanna',
    items: [
      { itemName: 'Bifacial Solar PV Module 550W TopCon (Tier 1)', quantity: 10, unitPrice: 12500 },
      { itemName: 'Three Phase On-Grid Solar Inverter 10kW IP65', quantity: 1, unitPrice: 48000 },
      { itemName: 'Aluminium Module Mounting Structures (4 Module table)', quantity: 5, unitPrice: 3200 },
      { itemName: 'DC Distribution Box with Type II SPD & Fuse Protection', quantity: 2, unitPrice: 4500 },
      { itemName: 'Solar DC Cable 4 sq.mm UV Protected Double Insulated', quantity: 100, unitPrice: 45 },
    ],
    row2Description: 'Comprehensive AMC & Monitoring (1 Year)',
    row2UnitPrice: 6000,
    row2Quantity: 1,
    row3Description: 'Complete Electrical Installation & Testing',
    row3UnitPrice: 8500,
    row3Quantity: 1,
    taxRate: 18,
  };

  const res1 = await postJson('/api/quotations/generate-pdf', t4FiveItems);
  console.log('Test 1 (5 items single page) status:', res1.statusCode);
  if (res1.statusCode === 200) {
    fs.writeFileSync('test_output/t4_5items.pdf', res1.buffer);
    console.log('Saved test_output/t4_5items.pdf (size:', res1.buffer.length, 'bytes)');
  } else {
    console.error('Test 1 failed:', res1.buffer.toString());
  }

  // 2. Multi-page mode with 12 items
  const t4TwelveItems = {
    templateId: 't4',
    quotationId: 'QT-2026-T4-12ITEMS',
    quotationDate: '2026-10-21',
    clientName: 'SunPower Renewable Megawatts Corporation Ltd',
    clientAddress: 'Industrial Zone IV, Greater Noida, Gautam Buddha Nagar, UP 201306',
    clientEmail: 'procurement@sunpower-energy.com',
    clientPhone: '+91 98222 33344',
    contactPerson: 'Ms. Priya Sharma',
    items: Array.from({ length: 12 }, (_, i) => ({
      itemName: `Solar System Component Spec Line #${i + 1} High Efficiency Standard`,
      quantity: (i + 1) * 2,
      unitPrice: 1500 * (i + 1),
    })),
    row2Description: 'Annual Maintenance Service & Preventive Care Contract',
    row2UnitPrice: 12000,
    row2Quantity: 1,
    row3Description: 'Turnkey Installation, Commissioning & Net Metering Liaison',
    row3UnitPrice: 25000,
    row3Quantity: 1,
    taxRate: 18,
  };

  const res2 = await postJson('/api/quotations/generate-pdf', t4TwelveItems);
  console.log('Test 2 (12 items multi-page) status:', res2.statusCode);
  if (res2.statusCode === 200) {
    fs.writeFileSync('test_output/t4_12items.pdf', res2.buffer);
    console.log('Saved test_output/t4_12items.pdf (size:', res2.buffer.length, 'bytes)');
  } else {
    console.error('Test 2 failed:', res2.buffer.toString());
  }

  // 3. Test T2 calculation does not include row2/row3
  const t2Data = {
    templateId: 't2',
    quotationId: 'QT-2026-T2-TEST',
    quotationDate: '2026-10-21',
    clientName: 'GreenTech Solutions',
    clientAddress: 'Sector 18, Chandigarh',
    clientEmail: 'info@greentech.com',
    items: [
      { itemName: 'Item 1', quantity: 2, unitPrice: 1000 },
    ],
    row2UnitPrice: 5000, // Should be IGNORED for T2
    row3UnitPrice: 3000, // Should be IGNORED for T2
    taxRate: 18,
  };

  const res3 = await postJson('/api/quotations', t2Data);
  if (res3.statusCode === 201) {
    const q3 = res3.json();
    console.log('Test 3 (T2 ignore row2/row3 check): Subtotal should be 2000 -> Got:', q3.subtotal);
    if (q3.subtotal === 2000) {
      console.log('SUCCESS: Row 2/3 charges correctly ignored for template T2!');
    } else {
      console.error('FAILURE: Row 2/3 was incorrectly added to T2 subtotal!');
    }
  }

  console.log('All backend checks completed!');
}

run().catch(console.error);
