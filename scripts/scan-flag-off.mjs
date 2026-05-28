import { chromium, devices } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3737";
const browser = await chromium.launch();
const context = await browser.newContext(devices["iPhone 14 Pro"]);
const page = await context.newPage();
await page.goto(BASE + "/count", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const fab = await page.locator('button[aria-label="Scan item with camera"]').count();
console.log(`FAB present without flag: ${fab}`); // expect 0
await browser.close();
