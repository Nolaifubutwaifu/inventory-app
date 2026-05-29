#!/usr/bin/env node
// Multi-user isolation test — register user A, add an item, sign out, register
// user B, confirm A's item is invisible, sign back into A, confirm A's item
// is still there. Guards against the userId-scoping regression that breaks
// the prototype-for-small-businesses story.
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

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function register(email, business) {
  await page.goto("http://localhost:3000/auth/register");
  await page.waitForTimeout(400);
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Your name").fill(business);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("isolate123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/welcome/, { timeout: 6000 }).catch(() => {
    fail(`register ${email} did not redirect to /welcome`);
  });
  await page.getByRole("button", { name: /skip/i }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", {
    timeout: 6000,
  }).catch(() => fail("skip onboarding failed"));
}

async function login(email) {
  await page.goto("http://localhost:3000/auth/login");
  await page.waitForTimeout(400);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("isolate123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page
    .waitForURL((u) => !new URL(u).pathname.startsWith("/auth/"), {
      timeout: 6000,
    })
    .catch(() => fail("login did not redirect away from /auth"));
}

async function signOut() {
  await page.goto("http://localhost:3000/account");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^sign out$/i }).click();
  await page.waitForTimeout(250);
  // Confirm dialog
  await page
    .getByRole("button", { name: /^sign out$/i })
    .last()
    .click();
  await page.waitForURL(/\/auth\/login/, { timeout: 6000 }).catch(() => {
    fail("sign out did not redirect to /auth/login");
  });
}

async function createItem(name) {
  await page.goto("http://localhost:3000/items/new");
  await page.waitForTimeout(400);
  await page.getByLabel("Item name").fill(name);
  await page.getByLabel("SKU", { exact: true }).fill(`SKU-${name}`);
  await page.getByRole("button", { name: /create item/i }).click();
  await page.waitForURL(/\/items($|\?)/, { timeout: 6000 }).catch(() => {
    fail("create item did not redirect to /items");
  });
}

async function itemsListContains(name) {
  await page.goto("http://localhost:3000/items");
  await page.waitForTimeout(600);
  const body = await page.locator("body").innerText();
  return body.includes(name);
}

const ts = Date.now();
const emailA = `iso-a-${ts}@example.com`;
const emailB = `iso-b-${ts}@example.com`;
const itemA = `A-Widget-${ts}`;
const itemB = `B-Widget-${ts}`;

// --- A creates item A
await register(emailA, "Alpha Co");
console.log("registered A");
await createItem(itemA);
console.log("A created", itemA);
if (!(await itemsListContains(itemA))) fail("A cannot see their own item");

// --- A signs out, B registers
await signOut();
console.log("A signed out");
await register(emailB, "Beta Co");
console.log("registered B");

if (await itemsListContains(itemA)) fail(`leak: B sees A's item ${itemA}`);
console.log("isolation OK — B does not see A's item");

// B's seed items are present, but A's manually-created one should not be
await createItem(itemB);
if (!(await itemsListContains(itemB))) fail("B cannot see their own item");

// --- B signs out, A signs back in
await signOut();
await login(emailA);
console.log("A signed back in");
if (!(await itemsListContains(itemA))) fail(`A lost their item ${itemA}`);
if (await itemsListContains(itemB)) fail(`leak: A sees B's item ${itemB}`);
console.log("isolation OK on return — A sees A only");

if (pageErrors.length) {
  console.error("page errors:", pageErrors);
  process.exit(1);
}
await ctx.close();
console.log("done — multi-user isolation verified");
