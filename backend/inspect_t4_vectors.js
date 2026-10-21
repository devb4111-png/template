const fs = require('fs');
const zlib = require('zlib');

function inspectT4Vectors() {
  const buf = fs.readFileSync('templates/t4.pdf');
  const content = buf.toString('latin1');
  
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  let count = 0;
  while ((match = streamRegex.exec(content)) !== null) {
    count++;
    const rawData = Buffer.from(match[2], 'latin1');
    let dec = '';
    try {
      dec = zlib.inflateSync(rawData).toString('latin1');
    } catch (e) {
      dec = rawData.toString('latin1');
    }

    // Look for cm and drawing ops
    const cmMatch = dec.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+cm/);
    console.log(`Stream #${count}: cm =`, cmMatch ? cmMatch[0] : 'None');

    const lines = dec.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.endsWith('re') || trimmed.endsWith('m') || trimmed.endsWith('l') || trimmed.endsWith('S') || trimmed.endsWith('f')) {
        if (trimmed.length < 80) console.log(`   ${trimmed}`);
      }
    });
  }
}

inspectT4Vectors();
