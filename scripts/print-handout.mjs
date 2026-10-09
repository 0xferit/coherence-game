import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const ORIGIN = process.env["PRINT_ORIGIN"] || "http://localhost:8787";
const OUT = fileURLToPath(new URL("../public/handout/handout.pdf", import.meta.url));
const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const SIZE_TOLERANCE_POINTS = 1;
const EXPECTED_PAGES = 1;
const SCRATCH = fileURLToPath(new URL("../tmp/pdfs/", import.meta.url));
await mkdir(SCRATCH, { recursive: true });
const profile = await mkdtemp(join(SCRATCH, "handout-browser-"));
let context;
try {
  context = await chromium.launchPersistentContext(
    profile,
    process.env["PRINT_BROWSER"] ? { executablePath: process.env["PRINT_BROWSER"] } : {},
  );
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/handout/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  await page.pdf({ path: OUT, format: "A4", printBackground: true, preferCSSPageSize: true });
  const document = await PDFDocument.load(await readFile(OUT));
  const pages = document.getPages();
  if (pages.length !== EXPECTED_PAGES)
    throw new Error(`Handout has ${pages.length} pages; expected one`);
  const { width, height } = pages[0].getSize();
  if (
    Math.abs(width - A4_WIDTH_POINTS) > SIZE_TOLERANCE_POINTS ||
    Math.abs(height - A4_HEIGHT_POINTS) > SIZE_TOLERANCE_POINTS
  )
    throw new Error(`Expected A4, got ${width} x ${height} points`);
  console.log(`Verified handout: one A4 page, ${width.toFixed(2)} x ${height.toFixed(2)} points`);
} finally {
  try {
    await context?.close();
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}
