const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderAllVerification() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const targets = [
    { file: 'test_output/t2_single.pdf', page: 1, out: 'test_output/verify_t2_single.png' },
    { file: 'test_output/t2_25_items.pdf', page: 1, out: 'test_output/verify_t2_25_p1.png' },
    { file: 'test_output/t2_25_items.pdf', page: 2, out: 'test_output/verify_t2_25_p2.png' },
    { file: 'test_output/t3_single.pdf', page: 1, out: 'test_output/verify_t3_single.png' },
    { file: 'test_output/t3_25_items.pdf', page: 1, out: 'test_output/verify_t3_25_p1.png' },
    { file: 'test_output/t3_25_items.pdf', page: 2, out: 'test_output/verify_t3_25_p2.png' },
    { file: 'test_output/t4_single.pdf', page: 1, out: 'test_output/verify_t4_single.png' },
    { file: 'test_output/t4_25_items.pdf', page: 1, out: 'test_output/verify_t4_25_p1.png' },
    { file: 'test_output/t4_25_items.pdf', page: 2, out: 'test_output/verify_t4_25_p2.png' },
  ];

  for (const t of targets) {
    const page = await browser.newPage();
    // High-resolution viewport so the whole PDF page with borders is visible
    await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1.0 });
    const absPath = path.resolve(t.file);
    const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${t.page}&toolbar=0&navpanes=0&view=Fit`;
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: t.out });
    console.log(`Rendered: ${t.out}`);
    await page.close();
  }

  await browser.close();
  console.log('All verification renders completed.');
}

renderAllVerification().catch(console.error);
