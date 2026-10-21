const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

async function inspectAllStreams() {
  const buf = fs.readFileSync('templates/t2.pdf');
  const doc = await PDFDocument.load(buf);
  const page = doc.getPage(0);
  console.log('Page contents:', page.node.Contents() ? 'has Contents' : 'no Contents');
  const stream = page.node.Contents();
  const raw = stream ? stream.asUint8Array() : null;
  if (raw) {
    try {
      const dec = zlib.inflateSync(raw).toString('latin1');
      console.log('Page stream:\n', dec);
    } catch(e) {
      console.log('Page stream uncompressed:\n', Buffer.from(raw).toString('latin1'));
    }
  }
}

inspectAllStreams().catch(console.error);
