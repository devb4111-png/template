const fs = require('fs');
const zlib = require('zlib');

function inspectT4Details() {
  console.log('================== DETAILED T4 INSPECTION ==================');
  const buf = fs.readFileSync('templates/t4.pdf');
  const content = buf.toString('latin1');
  
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  let streamCount = 0;
  while ((match = streamRegex.exec(content)) !== null) {
    streamCount++;
    const dict = match[1];
    const rawData = Buffer.from(match[2], 'latin1');
    let decompressed = '';
    try {
      decompressed = zlib.inflateSync(rawData).toString('latin1');
    } catch (e) {
      decompressed = rawData.toString('latin1');
    }

    if (!decompressed.includes('BT')) {
      // Let's check if there are drawing paths or rectangles
      const lines = decompressed.split('\n').filter(l => l.includes(' re') || l.includes(' m ') || l.includes(' l '));
      if (lines.length > 0) {
        console.log(`Stream #${streamCount} has vector paths:`, lines.slice(0, 10));
      }
      continue;
    }

    console.log(`\n--- Stream #${streamCount} Text Content ---`);
    const cmMatch = decompressed.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+cm/);
    console.log('Stream cm:', cmMatch ? cmMatch[0] : 'None');

    const btMatches = decompressed.match(/BT[\s\S]*?ET/g);
    console.log(`Found ${btMatches ? btMatches.length : 0} text blocks in t4.`);

    btMatches.forEach((bt, idx) => {
      const tmMatch = bt.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+Tm/);
      const tfMatch = bt.match(/\/(\w+)\s+([0-9.]+)\s+Tf/);
      const font = tfMatch ? `${tfMatch[1]} ${tfMatch[2]}pt` : '';
      const rawX = tmMatch ? parseFloat(tmMatch[5]) : 0;
      const rawY = tmMatch ? parseFloat(tmMatch[6]) : 0;
      
      let str = '';
      const hexMatches = bt.match(/<([0-9A-Fa-f]+)>/g) || [];
      if (hexMatches.length > 0) {
        str = hexMatches.map(h => {
          const raw = Buffer.from(h.slice(1, -1), 'hex');
          // Let's see if plain ascii or shifted
          const plain = raw.toString('ascii');
          const shifted = raw.map(b => (b >= 35 && b <= 126 ? b - 3 : b)).toString('ascii');
          return `${plain} [shifted: ${shifted}]`;
        }).join('');
      } else {
        const tjMatches = bt.match(/\(([^)]*)\)/g);
        if (tjMatches) {
          str = tjMatches.map(m => m.slice(1, -1)).join('');
        }
      }
      console.log(`[#${idx+1}] rawX=${rawX}, rawY=${rawY} | ${font} | ${str.replace(/\\/g, '')}`);
    });
  }
}
inspectT4Details();
