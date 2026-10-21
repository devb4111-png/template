import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";

const templatesDir = path.join(__dirname, "../../templates");
const outDir = path.join(__dirname, "../../templates_inspected");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function inspectPdfLib() {
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".pdf"));

  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    console.log("====================================================");
    console.log(`File: ${file}`);
    console.log(`Page count: ${pdfDoc.getPageCount()}`);

    const pages = pdfDoc.getPages();
    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      console.log(`  Page ${i + 1}: width=${width}, height=${height}, rotation=${page.getRotation().angle}`);
    });

    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      console.log(`  AcroForm fields count: ${fields.length}`);
      fields.forEach((f) => {
        console.log(`    Field: "${f.getName()}" (Type: ${f.constructor.name})`);
      });
    } catch (e: any) {
      console.log(`  AcroForm error / not present: ${e.message}`);
    }
  }
}

async function renderImages() {
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".pdf"));
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const page = await browser.newPage();
    // Load local file in browser
    await page.goto(`file://${filePath}`, { waitUntil: "load" });
    await new Promise((r) => setTimeout(r, 1500));
    const outPng = path.join(outDir, `${file}.png`);
    await page.screenshot({ path: outPng, fullPage: true });
    console.log(`Rendered screenshot: ${outPng}`);
    await page.close();
  }

  await browser.close();
}

async function main() {
  await inspectPdfLib();
  try {
    await renderImages();
  } catch (err: any) {
    console.error("Render images error:", err.message);
  }
}

main().catch(console.error);
