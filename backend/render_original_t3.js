const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function renderOriginalT3() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1900, deviceScaleFactor: 1.0 });
  const absPath = path.resolve('templates/t3.pdf');
  const url = 'file:///' + absPath.replace(/\\/g, '/') + '#page=1&toolbar=0&navpanes=0&view=Fit';
  await page.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2000));
  
  const artifactDir = 'C:\\Users\\devb4\\.gemini\\antigravity-ide\\brain\\18ea205d-c8ff-40e5-9845-6d1d4d8c1ad4';
  const outPath = path.join(artifactDir, 't3_original_template.png');
  await page.screenshot({ path: outPath });
  console.log('Saved screenshot to:', outPath);

  await browser.close();
}

renderOriginalT3().catch(console.error);
