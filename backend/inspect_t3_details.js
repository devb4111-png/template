const fs = require('fs');
const zlib = require('zlib');

function inspectT3Details() {
  console.log('================== DETAILED T3 INSPECTION ==================');
  const buf = fs.readFileSync('templates/t3.pdf');
  const content = buf.toString('latin1');
  
  const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const dict = match[1];
    const rawData = Buffer.from(match[2], 'latin1');
    let decompressed = '';
    try {
      decompressed = zlib.inflateSync(rawData).toString('latin1');
    } catch (e) {}

    if (!decompressed.includes('BT')) continue;

    const cmMatch = decompressed.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+cm/);
    console.log('Stream cm:', cmMatch ? cmMatch[0] : 'None');

    const btMatches = decompressed.match(/BT[\s\S]*?ET/g);
    console.log(`Found ${btMatches ? btMatches.length : 0} text blocks in t3.`);

    btMatches.forEach((bt, idx) => {
      const tmMatch = bt.match(/([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+Tm/);
      const tfMatch = bt.match(/\/(\w+)\s+([0-9.]+)\s+Tf/);
      const font = tfMatch ? `${tfMatch[1]} ${(parseFloat(tfMatch[2]) * 0.75).toFixed(1)}pt` : '';
      const rawX = tmMatch ? parseFloat(tmMatch[5]) : 0;
      const rawY = tmMatch ? parseFloat(tmMatch[6]) : 0;
      const pdfX = (rawX * 0.75).toFixed(2);
      const pdfY = (842.88 - rawY * 0.75).toFixed(2);
      
      let str = '';
      const hexMatches = bt.match(/<([0-9A-Fa-f]+)>/g) || [];
      if (hexMatches.length > 0) {
        str = hexMatches.map(h => {
          const raw = Buffer.from(h.slice(1, -1), 'hex');
          return raw.map(b => (b >= 35 && b <= 126 ? b - 3 : b)).toString('ascii');
        }).join('');
      } else {
        const tjMatches = bt.match(/\(([^)]*)\)/g);
        if (tjMatches) {
          str = tjMatches.map(m => m.slice(1, -1)).join('');
        }
      }
      console.log(`[#${idx+1}] PDF X=${pdfX}, Y=${pdfY} | ${font} | ${str.replace(/\\/g, '')}`);
    });
  }
}
inspectT3Details();
