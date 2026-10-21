const fs = require('fs');
const zlib = require('zlib');

function inspectT3Vectors() {
  const buf = fs.readFileSync('templates/t3.pdf');
  const content = buf.toString('latin1');
  
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const rawData = Buffer.from(match[2], 'latin1');
    let decompressed = '';
    try {
      decompressed = zlib.inflateSync(rawData).toString('latin1');
    } catch (e) {}

    // Find all 're' or 'm / l'
    const lines = decompressed.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.endsWith('re') || trimmed.endsWith('m') || trimmed.endsWith('l')) {
        // Let's parse numbers
        const parts = trimmed.split(/\s+/);
        const op = parts[parts.length - 1];
        const nums = parts.slice(0, parts.length - 1).map(Number);
        if (op === 're' && nums.length === 4) {
          const [rx, ry, rw, rh] = nums;
          const px = rx * 0.75;
          const py = 842.88 - (ry + rh) * 0.75;
          const pw = rw * 0.75;
          const ph = rh * 0.75;
          if (py > 500 && py < 700) {
            console.log(`t3 RECT: px=${px.toFixed(2)}, py=${py.toFixed(2)}, pw=${pw.toFixed(2)}, ph=${ph.toFixed(2)}`);
          }
        } else if ((op === 'm' || op === 'l') && nums.length === 2) {
          const [rx, ry] = nums;
          const px = rx * 0.75;
          const py = 842.88 - ry * 0.75;
          if (py > 500 && py < 700) {
            console.log(`t3 LINE ${op}: px=${px.toFixed(2)}, py=${py.toFixed(2)}`);
          }
        }
      }
    });
  }
}

inspectT3Vectors();
