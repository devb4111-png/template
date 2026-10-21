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
  console.log('Testing Updated T4 Template and Row 2 / Row 3 Data Entries...');

  // Test 1: Generate PDF for T4 with custom Row 2 and Row 3 data entries
  const t4DataWithCharges = {
    templateId: 't4',
    quotationId: 'QT-2026-T4-CUSTOM',
    quotationDate: '2026-10-21',
    clientName: 'Apex Solar Utilities Pvt Ltd',
    clientAddress: 'Plot 45, Phase II, Industrial Area, Gurugram, Haryana 122015',
    clientEmail: 'billing@apexsolar.in',
    clientPhone: '+91 98111 22233',
    contactPerson: 'Mr. Rajesh Khanna',
    items: [
      { itemName: 'Bifacial Solar PV Module 550W TopCon (Tier 1)', quantity: 10, unitPrice: 12500 },
      { itemName: 'Three Phase On-Grid Solar Inverter 10kW IP65', quantity: 1, unitPrice: 48000 },
    ],
    row2Description: 'Comprehensive AMC & Monitoring (1 Year)',
    row2UnitPrice: 6000,
    row2Quantity: 1,
    row3Description: 'Complete Electrical Installation & Testing',
    row3UnitPrice: 8500,
    row3Quantity: 1,
    taxRate: 18,
  };

  const res1 = await postJson('/api/quotations/generate-pdf', t4DataWithCharges);
  console.log('Test 1 (T4 with Row 2 & 3 charges) status:', res1.statusCode);
  if (res1.statusCode === 200) {
    fs.writeFileSync('test_output/t4_custom_rows.pdf', res1.buffer);
    console.log('Saved test_output/t4_custom_rows.pdf (size:', res1.buffer.length, 'bytes)');
  } else {
    console.error('Test 1 Error:', res1.buffer.toString());
  }

  // Test 2: Generate PDF for T4 with default Row 2 and Row 3 (0 / empty price => Included)
  const t4DataIncluded = {
    templateId: 't4',
    quotationId: 'QT-2026-T4-DEFAULT',
    quotationDate: '2026-10-21',
    clientName: 'SunPower Technologies Ltd',
    clientAddress: 'Tech Zone IV, Greater Noida, UP 201306',
    clientEmail: 'info@sunpower.in',
    clientPhone: '+91 98222 33344',
    contactPerson: 'Ms. Priya Sharma',
    items: [
      { itemName: 'Mono Perc Half Cut Solar Panel 540W', quantity: 20, unitPrice: 11000 },
      { itemName: 'Solar Hybrid Inverter 15kVA MPPT Dual', quantity: 1, unitPrice: 75000 },
    ],
    row2Description: 'Product / service and specifications',
    row2UnitPrice: 0,
    row2Quantity: 1,
    row3Description: 'Installation / other charges, if applicable',
    row3UnitPrice: 0,
    row3Quantity: 1,
    taxRate: 18,
  };

  const res2 = await postJson('/api/quotations/generate-pdf', t4DataIncluded);
  console.log('Test 2 (T4 with Included Row 2 & 3) status:', res2.statusCode);
  if (res2.statusCode === 200) {
    fs.writeFileSync('test_output/t4_included_rows.pdf', res2.buffer);
    console.log('Saved test_output/t4_included_rows.pdf (size:', res2.buffer.length, 'bytes)');
  } else {
    console.error('Test 2 Error:', res2.buffer.toString());
  }

  // Test 3: Save to MongoDB
  const saveRes = await postJson('/api/quotations', t4DataWithCharges);
  console.log('Test 3 (Save quotation with Row 2 & Row 3 to MongoDB) status:', saveRes.statusCode);
  if (saveRes.statusCode === 201) {
    const saved = saveRes.json();
    console.log('Saved quotation successfully, ID:', saved._id);
    console.log('Saved row2Description:', saved.row2Description, 'row2UnitPrice:', saved.row2UnitPrice);
    console.log('Saved row3Description:', saved.row3Description, 'row3UnitPrice:', saved.row3UnitPrice);
    console.log('Saved Subtotal:', saved.subtotal, 'Grand Total:', saved.grandTotal);
  } else {
    console.error('Test 3 Error:', saveRes.buffer.toString());
  }

  console.log('\nAll tests completed!');
}

run().catch(console.error);
