import { chromium, devices } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3737";
const hideDevTools = `
  const styles = document.createElement('style');
  styles.textContent = \`
    nextjs-portal, [data-nextjs-toast], [data-nextjs-toast-wrapper] { display: none !important; }
  \`;
  document.head.appendChild(styles);
`;

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  colorScheme: "light",
});
const page = await context.newPage();
await page.goto(BASE + "/items/new", { waitUntil: "networkidle" });
await page.evaluate(hideDevTools);
await page.waitForTimeout(1200);

// Scroll to bottom so the ReferencePhotosField becomes visible
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: "screenshots/items-new-bottom.png", fullPage: false });
console.log("✓ items-new-bottom");
await browser.close();
