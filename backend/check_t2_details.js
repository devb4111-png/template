const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function inspectT2() {
  const bytes = fs.readFileSync('templates/t2.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  console.log('t2.pdf pages:', pdfDoc.getPageCount());
  const page = pdfDoc.getPage(0);
  console.log('t2.pdf size:', page.getSize());
}
inspectT2();
