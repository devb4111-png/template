const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

async function dumpT4Positions() {
  const buf = fs.readFileSync('templates/t4.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  const content = buf.toString('latin1');
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const rawData = Buffer.from(match[2], 'latin1');
    let dec = '';
    try { dec = zlib.inflateSync(rawData).toString('latin1'); } catch(e) { dec = rawData.toString('latin1'); }
    if (!dec.includes('BT')) continue;

    // Check texts
    const btMatches = dec.match(/BT[\s\S]*?ET/g) || [];
    btMatches.forEach(bt => {
      const tm = bt.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+Tm/);
      const tj = bt.match(/\(([^)]*)\)/);
      const hex = bt.match(/<([0-9A-Fa-f]+)>/);
      let text = tj ? tj[1] : (hex ? Buffer.from(hex[1], 'hex').toString('ascii') : '');
      if (tm && text) {
        console.log(`Tm: x=${tm[5]}, y=${tm[6]} | text=${text}`);
      }
    });
  }
}

dumpT4Positions().catch(console.error);
