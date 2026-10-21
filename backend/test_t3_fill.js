const fs = require('fs');
const { calculateQuotation } = require('./dist/services/calculation.service');
const { fillQuotationPdfTemplate } = require('./dist/services/pdfLibFiller.service');
const { execSync } = require('child_process');

async function testT3() {
  const quotationInput = {
    quotationId: 'QT-2026-9999',
    quotationDate: '2026-10-21',
    clientName: 'Shree Krishna Enterprises',
    clientEmail: 'contact@shreekrishna.com',
    clientAddress: 'Plot 45, Udyog Vihar Phase 4, Gurgaon, Haryana 122016',
    clientPhone: '+91 91234 56789',
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
    items: [
      { itemName: '540W Mono PERC Solar PV Panels (Tier 1)', quantity: 20, unitPrice: 12500 },
      { itemName: '10kW Three Phase On-Grid String Inverter', quantity: 1, unitPrice: 65000 },
      { itemName: 'HDG Aluminium Elevated Mounting Structure', quantity: 1, unitPrice: 28000 },
    ],
    taxRate: 18,
    terms: [
      '5 Years comprehensive on-site warranty for complete system.',
      'Delivery within 10 to 15 days of purchase order confirmation.',
      'Quotation valid for 30 days.',
    ],
    templateId: 't3',
  };

  const calculated = calculateQuotation(quotationInput);
  const pdfBuffer = await fillQuotationPdfTemplate(calculated, 't3');
  fs.writeFileSync('test_output/t3_manual_test.pdf', pdfBuffer);
  console.log('Generated test_output/t3_manual_test.pdf, size:', pdfBuffer.length);
}

testT3().catch(console.error);
