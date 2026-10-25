import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("document loads come from the network so a reload runs the latest export", () => {
  assert.match(sw, /networkFirst\(req, PAGES_CACHE\)/);
  assert.equal(sw.includes("staleWhileRevalidate"), false);
  assert.match(sw, /const VERSION = "v14"/);
});

test("the service worker script is not answered from the static cache", () => {
  const bypass = sw.indexOf('url.pathname === "/sw.js"');
  const staticCache = sw.indexOf("cacheFirst(req, STATIC_CACHE)");
  assert.ok(bypass !== -1, "sw.js is not excluded from the cache");
  assert.ok(staticCache !== -1);
  assert.ok(bypass < staticCache);
});
