const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('templates/t4.pdf');
const content = buf.toString('latin1');
const streamRegex = /<<([^>]+)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
let match;
let count = 0;
while ((match = streamRegex.exec(content)) !== null) {
  count++;
  const rawData = Buffer.from(match[2], 'latin1');
  let dec = '';
  try { dec = zlib.inflateSync(rawData).toString('latin1'); } catch(e) { dec = rawData.toString('latin1'); }
  fs.writeFileSync(`t4_stream_${count}.txt`, dec);
  console.log(`Stream ${count} written, length: ${dec.length}`);
}
