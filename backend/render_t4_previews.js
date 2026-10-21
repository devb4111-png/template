const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderT4Previews() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const tests = [
    { file: 'test_output/t4_5items.pdf', pageNum: 1, name: 't4_5items_page1.png' },
    { file: 'test_output/t4_12items.pdf', pageNum: 1, name: 't4_12items_page1.png' },
    { file: 'test_output/t4_12items.pdf', pageNum: 2, name: 't4_12items_page2.png' },
  ];

  for (const t of tests) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.0 });
    const absPath = path.resolve(t.file);
    const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${t.pageNum || 1}&toolbar=0&navpanes=0&view=Fit`;
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 2000));
    const out = `test_output/${t.name}`;
    await page.screenshot({ path: out });
    console.log(`Saved: ${out}`);
    await page.close();
  }

  await browser.close();
  console.log('T4 previews rendered.');
}

renderT4Previews().catch(console.error);
