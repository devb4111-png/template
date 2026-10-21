const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function inspectDoc(name) {
  console.log(`\n=== DOC: ${name} ===`);
  const buf = fs.readFileSync('test_output/' + name);
  const doc = await PDFDocument.load(buf);
  console.log('Page count:', doc.getPageCount());
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    console.log(`Page ${i + 1} size:`, page.getSize());
  }
}
async function main() {
  await inspectDoc('t2_single.pdf');
  await inspectDoc('t2_25_items.pdf');
  await inspectDoc('t3_single.pdf');
}
main();
