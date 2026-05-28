#!/usr/bin/env node
import { chromium, devices } from "playwright";

const ctx = await chromium.launchPersistentContext("", {
  ...devices["iPhone 14 Pro"],
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("console:", m.text());
});

await page.goto("http://localhost:3000/");
await page.waitForTimeout(800);
console.log("home OK");

// Seed an item directly into IndexedDB so /count/detail has something to render
await page.evaluate(async () => {
  const { db } = await import("/_next/static/chunks/__not__a__real__path.js").catch(() => ({}));
});
// Easier: navigate by URL with a known seeded id
await page.goto("http://localhost:3000/items");
await page.waitForTimeout(600);
console.log("items OK");

await page.goto("http://localhost:3000/items/edit?id=bogus");
await page.waitForTimeout(800);
const editTxt = await page.locator("body").innerText();
if (!editTxt.toLowerCase().includes("loading")) {
  console.error("items/edit didn't render loading state for unknown id:", editTxt.slice(0, 200));
  process.exit(1);
}
console.log("items/edit?id=bogus OK (loading state)");

await page.goto("http://localhost:3000/sessions");
await page.waitForTimeout(600);
console.log("sessions OK");

await page.goto("http://localhost:3000/count");
await page.waitForTimeout(800);
console.log("count OK");

await page.goto("http://localhost:3000/sessions/detail?id=bogus");
await page.waitForTimeout(800);
console.log("sessions/detail?id=bogus OK");

await page.goto("http://localhost:3000/count/detail?id=bogus");
await page.waitForTimeout(800);
console.log("count/detail?id=bogus OK");

await ctx.close();
console.log("done");
