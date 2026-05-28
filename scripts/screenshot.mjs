import { chromium, devices } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3737";
const OUT = "screenshots";

const pages = [
  ["home", "/"],
  ["count", "/count"],
  ["items", "/items"],
  ["items-new", "/items/new"],
  ["sessions", "/sessions"],
  ["sessions-new", "/sessions/new"],
  ["export", "/export"],
];

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

for (const [name, path] of pages) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.evaluate(hideDevTools);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✓ ${name} → ${path}`);
}

await context.close();

const darkCtx = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  colorScheme: "dark",
});
const darkPage = await darkCtx.newPage();
await darkPage.goto(BASE + "/", { waitUntil: "networkidle" });
await darkPage.evaluate(hideDevTools);
await darkPage.waitForTimeout(2500);
await darkPage.screenshot({ path: `${OUT}/home-dark.png`, fullPage: false });
console.log("✓ home-dark");

const countCtx = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  colorScheme: "light",
});
const countPage = await countCtx.newPage();
await countPage.goto(BASE + "/count", { waitUntil: "networkidle" });
await countPage.evaluate(hideDevTools);
await countPage.waitForTimeout(2500);
const firstItemLink = countPage.locator('a[href^="/count/"]').first();
if (await firstItemLink.count()) {
  await firstItemLink.click();
  await countPage.waitForLoadState("networkidle");
  await countPage.evaluate(hideDevTools);
  await countPage.waitForTimeout(800);
  await countPage.screenshot({
    path: `${OUT}/count-detail.png`,
    fullPage: false,
  });
  console.log("✓ count-detail");
}

await browser.close();
