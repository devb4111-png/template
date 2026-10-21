const fs = require('fs');

const s1 = fs.readFileSync('t4_stream_1.txt', 'latin1');

function mult(m1, m2) {
  // m1 is applied to m2 (m1 * m2)
  return [
    m1[0]*m2[0] + m1[1]*m2[2],
    m1[0]*m2[1] + m1[1]*m2[3],
    m1[2]*m2[0] + m1[3]*m2[2],
    m1[2]*m2[1] + m1[3]*m2[3],
    m1[4]*m2[0] + m1[5]*m2[2] + m2[4],
    m1[4]*m2[1] + m1[5]*m2[3] + m2[5]
  ];
}

// In PDF: Point P_user = [x_text, y_text, 1] * Tm * CTM
// where CTM is the combination of all active 'cm' operations
function applyTransform(x, y, tm, ctm) {
  const m = mult(tm, ctm);
  return {
    x: x * m[0] + y * m[2] + m[4],
    y: x * m[1] + y * m[3] + m[5]
  };
}

function decodeHex(hexStr) {
  const b = Buffer.from(hexStr, 'hex');
  const shifted = b.map(x => (x >= 35 && x <= 126 ? x - 3 : x)).toString('latin1');
  return shifted;
}

const tokens = s1.split(/\s+/);
let ctmStack = [];
let ctm = [1, 0, 0, 1, 0, 0];
let tm = [1, 0, 0, 1, 0, 0];
let tlm = [1, 0, 0, 1, 0, 0];
let currentFont = '';
let currentFontSize = 0;

let currentTextRun = [];

let i = 0;
while (i < tokens.length) {
  const tok = tokens[i];
  if (tok === 'q') {
    ctmStack.push([...ctm]);
  } else if (tok === 'Q') {
    if (ctmStack.length > 0) {
      ctm = ctmStack.pop();
    }
  } else if (tok === 'cm') {
    const a = parseFloat(tokens[i-6]), b = parseFloat(tokens[i-5]), c = parseFloat(tokens[i-4]), d = parseFloat(tokens[i-3]), e = parseFloat(tokens[i-2]), f = parseFloat(tokens[i-1]);
    ctm = mult([a,b,c,d,e,f], ctm);
  } else if (tok === 'BT') {
    tm = [1,0,0,1,0,0];
    tlm = [1,0,0,1,0,0];
  } else if (tok === 'ET') {
    if (currentTextRun.length > 0) {
      const fullText = currentTextRun.map(r => r.char).join('');
      const minX = Math.min(...currentTextRun.map(r => r.x));
      const maxX = Math.max(...currentTextRun.map(r => r.x));
      const minY = Math.min(...currentTextRun.map(r => r.y));
      const maxY = Math.max(...currentTextRun.map(r => r.y));
      if (fullText.trim().length > 0 && minY > 520) {
        console.log(`[Text] "${fullText.trim()}" | x: ${minX.toFixed(1)}..${maxX.toFixed(1)}, y: ${minY.toFixed(1)}..${maxY.toFixed(1)} | size: ${currentFontSize}`);
      }
      currentTextRun = [];
    }
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
  } else if (tok === 'Tj') {
    let rawStr = tokens[i-1];
    let decoded = '';
    if (rawStr.startsWith('<') && rawStr.endsWith('>')) {
      decoded = decodeHex(rawStr.slice(1, -1));
    } else if (rawStr.startsWith('(') && rawStr.endsWith(')')) {
      decoded = rawStr.slice(1, -1);
    }
    const pt = applyTransform(0, 0, tm, ctm);
    for (let c of decoded) {
      currentTextRun.push({ char: c, x: pt.x, y: pt.y });
    }
  }
  i++;
}
