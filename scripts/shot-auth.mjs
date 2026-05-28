#!/usr/bin/env node
// Capture screenshots of the new auth/onboarding/account flows on iPhone viewport.
import { chromium, devices } from "playwright";

const ctx = await chromium.launchPersistentContext("", {
  ...devices["iPhone 14 Pro"],
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));

const shots = "screenshots";

// Register page
await page.goto("http://localhost:3000/auth/register");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/auth-register.png` });
console.log("auth-register.png");

// Login page (visit directly)
await page.goto("http://localhost:3000/auth/login");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/auth-login.png` });
console.log("auth-login.png");

// Register a user to capture onboarding + signed-in screens
await page.goto("http://localhost:3000/auth/register");
await page.waitForTimeout(400);
const email = `shot-${Date.now()}@example.com`;
await page.getByLabel("Business name").fill("Acme Storage Co.");
await page.getByLabel("Your name").fill("Sam");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("password123");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL(/\/welcome/, { timeout: 5000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/welcome-1.png` });
console.log("welcome-1.png");

// Advance through onboarding slides
await page.getByRole("button", { name: /^next$/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/welcome-2.png` });
console.log("welcome-2.png");

await page.getByRole("button", { name: /^next$/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/welcome-3.png` });
console.log("welcome-3.png");

await page.getByRole("button", { name: /^next$/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/welcome-4.png` });
console.log("welcome-4.png");

await page.getByRole("button", { name: /get started/i }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/home-after-onboarding.png` });
console.log("home-after-onboarding.png");

await page.goto("http://localhost:3000/account");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/account.png` });
console.log("account.png");

await ctx.close();
console.log("done");
