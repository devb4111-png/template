const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

// Inspect t2.pdf resources and text
async function inspectT2Details() {
  console.log('================== DETAILED T2 INSPECTION ==================');
  const buf = fs.readFileSync('templates/t2.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  const { width, height } = page.getSize();
  console.log(`Page dimensions: width=${width}, height=${height}`);

  // Inspect Form XObject X12
  const resources = page.node.Resources();
  const xObject = resources.lookup(doc.context.obj('XObject'));
  const x12Ref = xObject.get(doc.context.obj('X12'));
  const x12 = doc.context.lookup(x12Ref);
  const dec = zlib.inflateSync(x12.contents).toString('latin1');

  // Find all text blocks in X12
  const btMatches = dec.match(/BT[\s\S]*?ET/g);
  console.log(`Found ${btMatches ? btMatches.length : 0} text blocks in t2 X12.`);

  // Parse each BT block
  if (btMatches) {
    btMatches.forEach((bt, idx) => {
      // Find font, font size, matrix, text
      const tfMatch = bt.match(/\/(\w+)\s+([0-9.]+)\s+Tf/);
      const tmMatch = bt.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+Tm/);
      const tjMatches = bt.match(/\(([^)]*)\)\s*Tj|<([0-9A-Fa-f]+)>\s*Tj|\[(.*?)\]\s*TJ/g);
      
      const font = tfMatch ? `${tfMatch[1]} ${tfMatch[2]}pt` : 'unknown font';
      const matrix = tmMatch ? `Tm: [${tmMatch[1]}, ${tmMatch[2]}, ${tmMatch[3]}, ${tmMatch[4]}, ${tmMatch[5]}, ${tmMatch[6]}]` : 'no Tm';
      const text = tjMatches ? tjMatches.join(' ') : 'no text';
      console.log(`Block #${idx + 1}: ${matrix} | ${font} | ${text.slice(0, 80)}`);
    });
  }
}

inspectT2Details().catch(console.error);
