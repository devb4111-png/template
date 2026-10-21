const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderT2() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1.0 });
  const absPath = path.resolve('test_output/t2_single.pdf');
  const url = 'file:///' + absPath.replace(/\\/g, '/') + '#page=1&toolbar=0&navpanes=0&view=Fit';
  await page.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'test_output/t2_inspect_single.png' });
  console.log('Saved: test_output/t2_inspect_single.png');
  await browser.close();
}

renderT2().catch(console.error);
