const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

async function inspectT2Vectors() {
  const buf = fs.readFileSync('templates/t2.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  const resources = page.node.Resources();
  const xObject = resources.lookup(doc.context.obj('XObject'));
  const x12 = doc.context.lookup(xObject.get(doc.context.obj('X12')));
  const dec = zlib.inflateSync(x12.contents).toString('latin1');

  // Search for path construction in X12
  // We want to see all lines/rectangles around Y=300 to 500
  const lines = dec.split('\n');
  console.log('Total stream lines in X12:', lines.length);

  // Look for lines with re or m ... l ... S
  const pathRegex = /([0-9.\-\s]+)\s+(m|l|re|c|v|y)\b/g;
  let match;
  while ((match = pathRegex.exec(dec)) !== null) {
    const coords = match[1].trim().split(/\s+/).map(Number);
    const op = match[2];
    if (op === 're') {
      // x y w h re
      const [x, y, w, h] = coords;
      // In page coordinates: ctm is .24 0 0 -.24 0 850.08
      const pageY = 850.08 - 0.24 * (y + h);
      const pageX = 0.24 * x;
      if (pageY > 300 && pageY < 500) {
        console.log(`RECT: stream(${x}, ${y}, ${w}, ${h}) -> Page ~ X=${pageX.toFixed(1)}, Y=${pageY.toFixed(1)}, W=${(w*0.24).toFixed(1)}, H=${(h*0.24).toFixed(1)}`);
      }
    } else if (op === 'm' || op === 'l') {
      const [x, y] = coords;
      const pageY = 850.08 - 0.24 * y;
      const pageX = 0.24 * x;
      if (pageY > 350 && pageY < 500) {
        // console.log(`LINE ${op}: stream(${x}, ${y}) -> Page ~ X=${pageX.toFixed(1)}, Y=${pageY.toFixed(1)}`);
      }
    }
  }
}

inspectT2Vectors().catch(console.error);
