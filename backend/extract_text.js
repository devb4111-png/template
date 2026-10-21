const fs = require('fs');
const puppeteer = require('puppeteer-core');
const path = require('path');

async function extractTextFromPdfPage(pdfRelativePath) {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const absPath = path.resolve(pdfRelativePath);
  await page.goto('file:///' + absPath.replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));

  // Evaluate text from the PDF viewer DOM
  const textContent = await page.evaluate(() => {
    return document.body.innerText;
  });

  console.log(`\n================ TEXT FROM ${pdfRelativePath} ================`);
  console.log(textContent);

  await browser.close();
}

async function run() {
  await extractTextFromPdfPage('templates/t2.pdf');
  await extractTextFromPdfPage('templates/t3.pdf');
  await extractTextFromPdfPage('test_output/t2_single.pdf');
  await extractTextFromPdfPage('test_output/t3_single.pdf');
}
run().catch(console.error);
