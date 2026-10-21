const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

async function findTableLine() {
  const buf = fs.readFileSync('templates/t2.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  const resources = page.node.Resources();
  const xObject = resources.lookup(doc.context.obj('XObject'));
  const x12 = doc.context.lookup(xObject.get(doc.context.obj('X12')));
  const dec = zlib.inflateSync(x12.contents).toString('latin1');

  // Let's print any 're' or any draw operations in X12
  const reMatches = [...dec.matchAll(/([0-9.\-\s]+)\s+(re|m|l|S|f)\b/g)];
  for (const m of reMatches) {
    if (m[2] === 're') {
      console.log('X12 re:', m[0]);
    }
  }
}

findTableLine().catch(console.error);
