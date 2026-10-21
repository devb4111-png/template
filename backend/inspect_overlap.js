const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function inspectOverlap(filename) {
  console.log(`\n================ INSPECTING ${filename} ================`);
  const buf = fs.readFileSync('test_output/' + filename);
  const pdfDoc = await PDFDocument.load(buf);
  console.log('Page count:', pdfDoc.getPageCount());
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`Page ${i + 1}: ${width} x ${height}`);
  }
}

async function run() {
  await inspectOverlap('t2_single.pdf');
  await inspectOverlap('t2_25_items.pdf');
  await inspectOverlap('t3_single.pdf');
}
run();
