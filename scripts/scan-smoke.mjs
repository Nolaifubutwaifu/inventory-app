// Walk the scan UX with playwright using SCAN_MOCK=1.
import { chromium, devices } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3737";
const OUT = "screenshots";

const hideDevTools = `
  const styles = document.createElement('style');
  styles.textContent = \`
    nextjs-portal, [data-nextjs-toast], [data-nextjs-toast-wrapper] { display: none !important; }
  \`;
  document.head.appendChild(styles);
`;

// 1x1 red PNG as data URL, used both as fake reference and fake query.
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_DATA_URL.split(",")[1], "base64");

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  colorScheme: "light",
});
const page = await context.newPage();
await page.goto(BASE + "/count", { waitUntil: "networkidle" });
await page.evaluate(hideDevTools);

// Stamp every item with one reference photo via Dexie so the scan endpoint accepts them.
await page.evaluate(async (refUrl) => {
  // Dexie is bundled into the app; reach it via the existing live db handle.
  const db = await new Promise((res) => {
    const open = indexedDB.open("inventory-app");
    open.onsuccess = () => res(open.result);
    open.onerror = () => res(null);
  });
  if (!db) return;
  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");
  await new Promise((res) => {
    const cur = store.openCursor();
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return res(null);
      const it = c.value;
      it.referencePhotos = [refUrl];
      c.update(it);
      c.continue();
    };
  });
  await new Promise((res) => (tx.oncomplete = res));
  db.close();
}, TINY_PNG_DATA_URL);

await page.reload({ waitUntil: "networkidle" });
await page.evaluate(hideDevTools);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/scan-fab.png`, fullPage: false });
console.log("✓ scan-fab");

await page.setInputFiles('input[type="file"][accept="image/*"]', {
  name: "query.png",
  mimeType: "image/png",
  buffer: TINY_PNG_BUFFER,
});

await page.waitForSelector("text=Scan result", { timeout: 5000 });
// Wait for the candidate buttons to render (out of loading state)
await page
  .locator('button:has-text("%")')
  .first()
  .waitFor({ timeout: 5000 })
  .catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(hideDevTools);
await page.screenshot({ path: `${OUT}/scan-results.png`, fullPage: false });
console.log("✓ scan-results");

await browser.close();
console.log("done");
