const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderAllPages() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  fs.mkdirSync('test_output/page_previews', { recursive: true });

  const tests = [
    { file: 'test_output/t2_single.pdf', pages: 1, name: 't2_single' },
    { file: 'test_output/t2_25_items.pdf', pages: 2, name: 't2_25_items' },
    { file: 'test_output/t3_single.pdf', pages: 1, name: 't3_single' },
    { file: 'test_output/t3_25_items.pdf', pages: 2, name: 't3_25_items' },
  ];

  for (const t of tests) {
    for (let p = 1; p <= t.pages; p++) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 1900, deviceScaleFactor: 1.0 });
      const absPath = path.resolve(t.file);
      const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${p}&toolbar=0&navpanes=0&view=Fit`;
      await page.goto(url, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 2000));
      const out = `test_output/page_previews/${t.name}_page${p}_perfect.png`;
      await page.screenshot({ path: out });
      console.log(`Saved: ${out}`);
      await page.close();
    }
  }

  await browser.close();
  console.log('All page screenshots rendered.');
}
renderAllPages().catch(console.error);
