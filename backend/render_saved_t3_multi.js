const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderSavedT3Multi() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const artifactDir = 'C:\\Users\\devb4\\.gemini\\antigravity-ide\\brain\\18ea205d-c8ff-40e5-9845-6d1d4d8c1ad4';
  const absPath = path.resolve('test_output/t3_saved_QT-2026-MULTI-1792574325.pdf');

  for (let p = 1; p <= 2; p++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1900, deviceScaleFactor: 1.0 });
    const url = 'file:///' + absPath.replace(/\\/g, '/') + `#page=${p}&toolbar=0&navpanes=0&view=Fit`;
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 2000));
    
    const outPath = path.join(artifactDir, `t3_saved_multi_p${p}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Saved screenshot page ${p} to:`, outPath);
    await page.close();
  }

  await browser.close();
}

renderSavedT3Multi().catch(console.error);
