const puppeteer = require('puppeteer-core');

async function captureFrontendScreenshot() {
  const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1.0 });
  await page.goto('http://localhost:3001', { waitUntil: 'load', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Capture t4 (Product Specifications & Pricing template)
  await page.evaluate(() => {
    const select = document.querySelector('select');
    if (select) {
      select.value = 't4';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const outT4 = 'test_output/frontend_t4_customer_details.png';
  await page.screenshot({ path: outT4, fullPage: false });
  console.log(`Saved screenshot to: ${outT4}`);

  // 2. Capture t2 (Default template - should NOT have row 2 or row 3)
  await page.evaluate(() => {
    const select = document.querySelector('select');
    if (select) {
      select.value = 't2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const outT2 = 'test_output/frontend_t2_clean_customer_details.png';
  await page.screenshot({ path: outT2, fullPage: false });
  console.log(`Saved screenshot to: ${outT2}`);

  await browser.close();
}

captureFrontendScreenshot().catch(console.error);
