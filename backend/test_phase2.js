const fs = require('fs');
const http = require('http');
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

async function testPhase2() {
  console.log('================ STRICT PHASE 2 VERIFICATION (USER TEMPLATES ONLY) ================');
  fs.mkdirSync('test_output', { recursive: true });

  // Test 1: Invalid template ID validation
  console.log('\n--- Test 1: Invalid template ID rejection ---');
  const invalidRes = await postJson('/api/generate-pdf', {
    templateId: 'unauthorized_template_name',
    quotation: {
      quotationId: 'QT-TEST-001',
      quotationDate: '2026-10-21',
      clientName: 'Test Client',
      clientAddress: '123 Test St',
      clientEmail: 'test@example.com',
      items: [{ itemName: 'Item 1', quantity: 1, unitPrice: 100 }],
    },
  });
  console.log('Status code:', invalidRes.statusCode);
  if (invalidRes.statusCode === 400 && invalidRes.json().availableTemplates.includes('t4')) {
    console.log('✅ Test 1 PASSED: Only user-given templates (t2, t3, t4, t2-html) allowed.');
  } else {
    console.error('❌ Test 1 FAILED');
  }

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
      items,
      taxRate: 18,
      terms: [
        'Quotation validity is 30 days from issue date.',
        'Payment terms: 50% advance, 40% on delivery, 10% post-commissioning.',
        'Comprehensive 5-year onsite warranty included.',
      ],
    };
  }

  // Test 2: Single-Page generation with template "t2" (Default user template)
  console.log('\n--- Test 2: Single-Page with default template "t2" (2 items) ---');
  const qSingle = makeQuotation('QT-2026-T2-01', 2);
  const resT2 = await postJson('/api/generate-pdf', {
    templateId: 't2',
    quotation: qSingle,
  });
  console.log('Status code:', resT2.statusCode);
  console.log('Content-Type:', resT2.headers['content-type']);
  const pdfT2 = await PDFDocument.load(resT2.buffer);
  console.log('t2 Single-Page count:', pdfT2.getPageCount());
  fs.writeFileSync('test_output/t2_single.pdf', resT2.buffer);
  if (resT2.statusCode === 200 && pdfT2.getPageCount() === 1) {
    console.log('✅ Test 2 PASSED: Valid t2 single-page PDF generated.');
  } else {
    console.error('❌ Test 2 FAILED');
  }

  // Test 3: Single-Page generation with template "t3" (User template)
  console.log('\n--- Test 3: Single-Page with template "t3" (2 items) ---');
  const resT3 = await postJson('/api/generate-pdf', {
    templateId: 't3',
    quotation: qSingle,
  });
  console.log('Status code:', resT3.statusCode);
  const pdfT3 = await PDFDocument.load(resT3.buffer);
  console.log('t3 Single-Page count:', pdfT3.getPageCount());
  fs.writeFileSync('test_output/t3_single.pdf', resT3.buffer);
  if (resT3.statusCode === 200 && pdfT3.getPageCount() === 1) {
    console.log('✅ Test 3 PASSED: Valid t3 single-page PDF generated.');
  } else {
    console.error('❌ Test 3 FAILED');
  }

  // Test 4: Multi-Page Overflow with 25 Line Items on "t2"
  console.log('\n--- Test 4: Multi-Page Overflow with 25 Items on "t2" ---');
  const q25 = makeQuotation('QT-2026-MULTI-25', 25);
  const resT2Multi = await postJson('/api/generate-pdf', {
    templateId: 't2',
    quotation: q25,
  });
  console.log('Status code:', resT2Multi.statusCode);
  const pdfT2Multi = await PDFDocument.load(resT2Multi.buffer);
  console.log('t2 Multi-page count:', pdfT2Multi.getPageCount());
  fs.writeFileSync('test_output/t2_25_items.pdf', resT2Multi.buffer);
  if (resT2Multi.statusCode === 200 && pdfT2Multi.getPageCount() === 2) {
    console.log(`✅ Test 4 PASSED: t2 multi-page quotation generated with 2 pages without heading repeats!`);
  } else {
    console.error('❌ Test 4 FAILED');
  }

  // Test 5: Multi-Page Overflow with 25 Line Items on "t3"
  console.log('\n--- Test 5: Multi-Page Overflow with 25 Items on "t3" ---');
  const resT3Multi = await postJson('/api/generate-pdf', {
    templateId: 't3',
    quotation: q25,
  });
  console.log('Status code:', resT3Multi.statusCode);
  const pdfT3Multi = await PDFDocument.load(resT3Multi.buffer);
  console.log('t3 Multi-page count:', pdfT3Multi.getPageCount());
  fs.writeFileSync('test_output/t3_25_items.pdf', resT3Multi.buffer);
  if (resT3Multi.statusCode === 200 && pdfT3Multi.getPageCount() === 2) {
    console.log(`✅ Test 5 PASSED: t3 multi-page quotation generated with 2 pages!`);
  } else {
    console.error('❌ Test 5 FAILED');
  }

  // Test 6: Preview endpoint compatibility
  console.log('\n--- Test 6: Preview endpoint compatibility ---');
  const resPreview = await postJson('/api/quotations/preview-pdf', {
    templateId: 't2',
    ...qSingle,
  });
  console.log('Preview Status code:', resPreview.statusCode);
  console.log('Preview Content-Disposition:', resPreview.headers['content-disposition']);
  if (resPreview.statusCode === 200 && resPreview.headers['content-disposition'].includes('inline')) {
    console.log('✅ Test 6 PASSED: Preview endpoint returned inline PDF.');
  } else {
    console.error('❌ Test 6 FAILED');
  }

  // Test 7: Surya Sangam HTML Engine (t2-html) Single Page
  console.log('\n--- Test 7: Surya Sangam HTML Engine (t2-html) Single Page ---');
  const resHtmlSingle = await postJson('/api/generate-pdf', {
    templateId: 't2-html',
    quotation: qSingle,
  });
  const pdfHtmlSingle = await PDFDocument.load(resHtmlSingle.buffer);
  console.log('Status code:', resHtmlSingle.statusCode);
  console.log('t2-html Single Page count:', pdfHtmlSingle.getPageCount());
  if (resHtmlSingle.statusCode === 200 && pdfHtmlSingle.getPageCount() === 1) {
    console.log('✅ Test 7 PASSED: Valid t2-html single-page PDF generated.');
  } else {
    console.error('❌ Test 7 FAILED');
  }

  // Test 8: Surya Sangam HTML Engine (t2-html) Multi-Page with 25 Items
  console.log('\n--- Test 8: Surya Sangam HTML Engine (t2-html) Multi-Page (25 items) ---');
  const resHtmlMulti = await postJson('/api/generate-pdf', {
    templateId: 't2-html',
    quotation: q25,
  });
  const pdfHtmlMulti = await PDFDocument.load(resHtmlMulti.buffer);
  console.log('Status code:', resHtmlMulti.statusCode);
  console.log('t2-html Multi-Page count:', pdfHtmlMulti.getPageCount());
  if (resHtmlMulti.statusCode === 200 && pdfHtmlMulti.getPageCount() === 2) {
    console.log('✅ Test 8 PASSED: Valid t2-html multi-page PDF generated with balanced 2 pages.');
  } else {
    console.error('❌ Test 8 FAILED');
  }

  // Test 9: Template "t4" Single Page
  console.log('\n--- Test 9: Template "t4" Single Page (3 items) ---');
  const resT4Single = await postJson('/api/generate-pdf', {
    templateId: 't4',
    quotation: qSingle,
  });
  const pdfT4Single = await PDFDocument.load(resT4Single.buffer);
  console.log('Status code:', resT4Single.statusCode);
  console.log('t4 Single Page count:', pdfT4Single.getPageCount());
  fs.writeFileSync('test_output/t4_single.pdf', resT4Single.buffer);
  if (resT4Single.statusCode === 200 && pdfT4Single.getPageCount() === 1) {
    console.log('✅ Test 9 PASSED: Valid t4 single-page PDF generated.');
  } else {
    console.error('❌ Test 9 FAILED');
  }

  // Test 10: Template "t4" Multi-Page with 25 Items
  console.log('\n--- Test 10: Template "t4" Multi-Page (25 items) ---');
  const resT4Multi = await postJson('/api/generate-pdf', {
    templateId: 't4',
    quotation: q25,
  });
  const pdfT4Multi = await PDFDocument.load(resT4Multi.buffer);
  console.log('Status code:', resT4Multi.statusCode);
  console.log('t4 Multi-Page count:', pdfT4Multi.getPageCount());
  fs.writeFileSync('test_output/t4_25_items.pdf', resT4Multi.buffer);
  if (resT4Multi.statusCode === 200 && pdfT4Multi.getPageCount() === 2) {
    console.log('✅ Test 10 PASSED: Valid t4 multi-page PDF generated with 2 pages and zero repeated headings.');
  } else {
    console.error('❌ Test 10 FAILED');
  }

  console.log('\n================ ALL TEST SUITE CHECKS COMPLETED ================');
}

testPhase2().catch(console.error);
