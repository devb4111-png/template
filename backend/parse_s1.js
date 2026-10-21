const fs = require('fs');

const s1 = fs.readFileSync('t4_stream_1.txt', 'latin1');

// Let's find all BT ... ET blocks
const btRegex = /BT([\s\S]*?)ET/g;
let m;
let count = 0;
while ((m = btRegex.exec(s1)) !== null) {
  count++;
  const block = m[1];
  // extract any hex strings or ascii
  let text = '';
  const hex = block.match(/<([0-9A-Fa-f]+)>/g) || [];
  const tj = block.match(/\(([^)]*)\)/g) || [];
  if (hex.length > 0) {
    text = hex.map(h => {
      const b = Buffer.from(h.slice(1, -1), 'hex');
      return b.map(x => (x >= 35 && x <= 126 ? x - 3 : x)).toString('latin1');
    }).join(' ');
  } else if (tj.length > 0) {
    text = tj.join(' ');
  }
  // Also look for coordinates in block: Tm, Td, cm
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  console.log(`[Block ${count}] text: "${text.trim()}"`);
  console.log('   ops:', lines.join(' | '));
}
