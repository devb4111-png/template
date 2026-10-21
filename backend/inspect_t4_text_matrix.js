const fs = require('fs');
const zlib = require('zlib');

function parseStream() {
  const buf = fs.readFileSync('templates/t4.pdf');
  const content = buf.toString('latin1');
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const rawData = Buffer.from(match[2], 'latin1');
    let dec = '';
    try { dec = zlib.inflateSync(rawData).toString('latin1'); } catch(e) { dec = rawData.toString('latin1'); }
    if (!dec.includes('BT')) continue;

    // Let's trace text operations: cm, BT, ET, Tm, Td, TD, T*, Tj, TJ, etc.
    const tokens = dec.split(/\s+/);
    let ctm = [1, 0, 0, 1, 0, 0]; // current transformation matrix
    let tm = [1, 0, 0, 1, 0, 0];  // text matrix
    let tlm = [1, 0, 0, 1, 0, 0]; // text line matrix
    let currentFont = '';
    let currentFontSize = 0;

    function mult(m1, m2) {
      return [
        m1[0]*m2[0] + m1[1]*m2[2],
        m1[0]*m2[1] + m1[1]*m2[3],
        m1[2]*m2[0] + m1[3]*m2[2],
        m1[2]*m2[1] + m1[3]*m2[3],
        m1[4]*m2[0] + m1[5]*m2[2] + m2[4],
        m1[4]*m2[1] + m1[5]*m2[3] + m2[5]
      ];
    }

    function decodeHex(hexStr) {
      const b = Buffer.from(hexStr, 'hex');
      // If shifted
      const shifted = b.map(x => (x >= 35 && x <= 126 ? x - 3 : x)).toString('latin1');
      return shifted;
    }

    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok === 'cm') {
        const a = parseFloat(tokens[i-6]), b = parseFloat(tokens[i-5]), c = parseFloat(tokens[i-4]), d = parseFloat(tokens[i-3]), e = parseFloat(tokens[i-2]), f = parseFloat(tokens[i-1]);
        ctm = mult([a,b,c,d,e,f], ctm);
      } else if (tok === 'BT') {
        tm = [1,0,0,1,0,0];
        tlm = [1,0,0,1,0,0];
      } else if (tok === 'ET') {
        // end text
      } else if (tok === 'Tf') {
        currentFont = tokens[i-2];
        currentFontSize = parseFloat(tokens[i-1]);
      } else if (tok === 'Tm') {
        const a = parseFloat(tokens[i-6]), b = parseFloat(tokens[i-5]), c = parseFloat(tokens[i-4]), d = parseFloat(tokens[i-3]), e = parseFloat(tokens[i-2]), f = parseFloat(tokens[i-1]);
        tm = [a,b,c,d,e,f];
        tlm = [a,b,c,d,e,f];
      } else if (tok === 'Td' || tok === 'TD') {
        const tx = parseFloat(tokens[i-2]), ty = parseFloat(tokens[i-1]);
        const tr = [1, 0, 0, 1, tx, ty];
        tlm = mult(tr, tlm);
        tm = [...tlm];
      } else if (tok === 'T*') {
        // leading
      } else if (tok === 'Tj' || tok === 'TJ') {
        // calculate user space coordinate
        const userM = mult(tm, ctm);
        const userX = userM[4];
        const userY = userM[5];

        // get string
        let rawStr = tokens[i-1];
        let text = '';
        if (rawStr.startsWith('<') && rawStr.endsWith('>')) {
          text = decodeHex(rawStr.slice(1, -1));
        } else if (rawStr.startsWith('(') && rawStr.endsWith(')')) {
          text = rawStr.slice(1, -1);
        } else {
          // might be TJ array or previous tokens
          let j = i - 1;
          let combined = '';
          while (j >= 0 && (tokens[j].startsWith('<') || tokens[j].startsWith('(') || tokens[j].startsWith('[') || !isNaN(tokens[j]))) {
            if (tokens[j].startsWith('<')) {
              combined = decodeHex(tokens[j].replace(/[<>]/g, '')) + combined;
            }
            if (tokens[j].startsWith('[')) break;
            j--;
          }
          text = combined;
        }
        if (text.trim().length > 0) {
          console.log(`pos: (x=${userX.toFixed(1)}, y=${userY.toFixed(1)}) | size=${currentFontSize} | text="${text.trim()}"`);
        }
      }
      i++;
    }
  }
}

parseStream();
