const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
  ];
}

async function inspectT2Coords() {
  const buf = fs.readFileSync('templates/t2.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  const resources = page.node.Resources();
  const xObject = resources.lookup(doc.context.obj('XObject'));
  const x12 = doc.context.lookup(xObject.get(doc.context.obj('X12')));
  const dec = zlib.inflateSync(x12.contents).toString('latin1');

  // We know page calls X12 with:
  // .23999999 0 0 -.23999999 0 850.07996 cm ... /X12 Do
  const pageCtm = [0.24, 0, 0, -0.24, 0, 850.08];

  // In X12:
  // Track cm stack and BT ... ET
  const regex = /([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+cm|([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+Tm|q|Q|BT|ET|\(([^)]*)\)\s*Tj|<([0-9A-Fa-f]+)>\s*Tj/g;
  let match;
  let ctmStack = [];
  let curCtm = [...pageCtm];
  let curTm = [1, 0, 0, 1, 0, 0];
  let blockIndex = 0;

  while ((match = regex.exec(dec)) !== null) {
    const full = match[0];
    if (full === 'q') {
      ctmStack.push([...curCtm]);
    } else if (full === 'Q') {
      if (ctmStack.length) curCtm = ctmStack.pop();
    } else if (match[1] !== undefined) {
      // cm
      const m = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])];
      curCtm = multiply(m, curCtm);
    } else if (full === 'BT') {
      curTm = [1, 0, 0, 1, 0, 0];
      blockIndex++;
    } else if (match[7] !== undefined) {
      // Tm
      curTm = [parseFloat(match[7]), parseFloat(match[8]), parseFloat(match[9]), parseFloat(match[10]), parseFloat(match[11]), parseFloat(match[12])];
    } else if (match[13] !== undefined || match[14] !== undefined) {
      const eff = multiply(curTm, curCtm);
      const text = match[13] || `<hex:${match[14]}>`;
      console.log(`Block #${blockIndex}: Eff X=${eff[4].toFixed(2)}, Y=${eff[5].toFixed(2)} | Text: ${text.slice(0, 30)}`);
    }
  }
}
inspectT2Coords();
