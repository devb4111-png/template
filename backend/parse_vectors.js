const fs = require('fs');

const s1 = fs.readFileSync('t4_stream_1.txt', 'latin1');
const lines = s1.split('\n');

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

function applyTransform(x, y, ctm) {
  return {
    x: x * ctm[0] + y * ctm[2] + ctm[4],
    y: x * ctm[1] + y * ctm[3] + ctm[5]
  };
}

let ctmStack = [];
let ctm = [1, 0, 0, 1, 0, 0];
let curPt = { x: 0, y: 0 };

for (let line of lines) {
  const parts = line.trim().split(/\s+/);
  const op = parts[parts.length - 1];
  if (op === 'q') {
    ctmStack.push([...ctm]);
  } else if (op === 'Q') {
    if (ctmStack.length > 0) ctm = ctmStack.pop();
  } else if (op === 'cm') {
    const a = parseFloat(parts[0]), b = parseFloat(parts[1]), c = parseFloat(parts[2]), d = parseFloat(parts[3]), e = parseFloat(parts[4]), f = parseFloat(parts[5]);
    ctm = mult([a,b,c,d,e,f], ctm);
  } else if (op === 'm') {
    const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
    curPt = applyTransform(x, y, ctm);
  } else if (op === 'l') {
    const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
    const nextPt = applyTransform(x, y, ctm);
    // Print horizontal or vertical lines
    if (Math.abs(curPt.y - nextPt.y) < 1.0) {
      console.log(`H-Line: y=${curPt.y.toFixed(1)} | x: ${curPt.x.toFixed(1)} -> ${nextPt.x.toFixed(1)}`);
    } else if (Math.abs(curPt.x - nextPt.x) < 1.0) {
      console.log(`V-Line: x=${curPt.x.toFixed(1)} | y: ${curPt.y.toFixed(1)} -> ${nextPt.y.toFixed(1)}`);
    }
    curPt = nextPt;
  } else if (op === 're') {
    const x = parseFloat(parts[0]), y = parseFloat(parts[1]), w = parseFloat(parts[2]), h = parseFloat(parts[3]);
    const p1 = applyTransform(x, y, ctm);
    const p2 = applyTransform(x + w, y + h, ctm);
    console.log(`Rect: (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) to (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}) [w=${Math.abs(p2.x-p1.x).toFixed(1)}, h=${Math.abs(p2.y-p1.y).toFixed(1)}]`);
  }
}
