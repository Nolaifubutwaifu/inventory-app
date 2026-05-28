#!/usr/bin/env node
// End-to-end smoke test — register a user, complete onboarding, then visit
// every important route to confirm nothing throws.
import { chromium, devices } from "playwright";

const ctx = await chromium.launchPersistentContext("", {
  ...devices["iPhone 14 Pro"],
});
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => {
  pageErrors.push(e.message);
  console.error("pageerror:", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") console.error("console:", m.text());
});

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

// Visiting / when logged out should redirect to /auth/login
await page.goto("http://localhost:3000/");
await page.waitForURL(/\/auth\/login/, { timeout: 5000 }).catch(() => {
  fail("/ did not redirect to /auth/login when logged out");
});
console.log("redirect to login OK");

await page.goto("http://localhost:3000/auth/register");
await page.waitForTimeout(400);

const email = `smoke-${Date.now()}@example.com`;
await page.getByLabel("Business name").fill("Smoke Test Co.");
await page.getByLabel("Your name").fill("Smoke");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("smoke123");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL(/\/welcome/, { timeout: 5000 }).catch(() => {
  fail("Register did not redirect to /welcome");
});
console.log("register → /welcome OK");

// Click Skip
await page.getByRole("button", { name: /skip/i }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 }).catch(() => {
  fail("Skip onboarding did not return to /");
});
console.log("skip onboarding → / OK");

const protectedRoutes = [
  "/",
  "/items",
  "/items/new",
  "/items/edit?id=bogus",
  "/sessions",
  "/sessions/new",
  "/sessions/detail?id=bogus",
  "/count",
  "/count/detail?id=bogus",
  "/export",
  "/account",
];

for (const route of protectedRoutes) {
  await page.goto(`http://localhost:3000${route}`);
  await page.waitForTimeout(450);
  const txt = (await page.locator("body").innerText()).slice(0, 80).replace(/\n/g, " ");
  console.log(`${route} OK — "${txt}…"`);
}

// Logged-in user shouldn't be able to revisit /auth/login
await page.goto("http://localhost:3000/auth/login");
await page.waitForURL((u) => !new URL(u).pathname.startsWith("/auth/"), { timeout: 5000 }).catch(() => {
  fail("/auth/login did not redirect signed-in user away");
});
console.log("signed-in /auth/login bounce OK");

if (pageErrors.length) {
  console.error("page errors:", pageErrors);
  process.exit(1);
}

await ctx.close();
console.log("done — no page errors");
