#!/usr/bin/env node
// Capture App Store-ready screenshots at 1290x2796 (6.7" iPhone, required slot).
// Assumes the dev server is running at $BASE (default localhost:3000).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "screenshots/appstore";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

const ctx = await browser.newContext({
  // iPhone 16 Pro Max viewport — 430 CSS px wide × 932 tall, DPR 3 → 1290×2796 PNG.
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));

// Hide Next.js dev tools that float on top of the page
const hideDevTools = `
  const s = document.createElement('style');
  s.textContent = 'nextjs-portal,[data-nextjs-toast],[data-nextjs-toast-wrapper]{display:none!important}';
  document.head.appendChild(s);
`;

async function go(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.evaluate(hideDevTools);
  await page.waitForTimeout(800);
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
}

// Register a fresh account so we end up in a signed-in state with the
// seeded demo catalog visible.
await go("/auth/register");
const email = `appstore-${Date.now()}@example.com`;
await page.getByLabel("Business name").fill("Acme Storage Co.");
await page.getByLabel("Your name").fill("Sam");
await page.getByLabel("Email").fill(email);
await page.locator('input[autocomplete="new-password"]').fill("password123");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL(/\/welcome/, { timeout: 8000 });

// Skip the carousel to reach the seeded home state quickly.
const skip = page.getByRole("button", { name: /skip/i });
if (await skip.isVisible().catch(() => false)) {
  await skip.click();
} else {
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.waitForTimeout(150);
  }
  await page.getByRole("button", { name: /get started/i }).click();
}
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 });
await page.waitForTimeout(900);

// 1) Home
await page.evaluate(hideDevTools);
await shot("01-home");

// 2) Items list
await go("/items");
await shot("02-items");

// 3) Item detail (first item in the list)
const firstItemLink = page.locator('a[href^="/items/"]').first();
if (await firstItemLink.count()) {
  await firstItemLink.click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(hideDevTools);
  await page.waitForTimeout(700);
  await shot("03-item-detail");
}

// Need an active session for the count screen to have rows to count.
await go("/sessions/new");
await page.getByRole("button", { name: /start|create|save/i }).first().click();
await page.waitForURL(/\/sessions\/detail/, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);

// 4) Count screen — now has rows
await go("/count");
await shot("04-count");

// 5) Count item detail (tap into the first row)
const firstCountLink = page.locator('a[href^="/count/"]').first();
if ((await firstCountLink.count()) > 0) {
  await firstCountLink.click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(hideDevTools);
  await page.waitForTimeout(700);
  await shot("05-count-detail");
}

// 6) Sessions list
await go("/sessions");
await shot("06-sessions");

await ctx.close();
await browser.close();
console.log(`\nDone. ${OUT}/*.png are 1290x2796 — upload to App Store Connect under 6.7" iPhone.`);
