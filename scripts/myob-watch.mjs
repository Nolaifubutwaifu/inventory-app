#!/usr/bin/env node
// MYOB invoice folder watcher.
//
// Watches a folder for invoice files MYOB drops in (PDF or image), uploads each
// to the app's /api/invoice endpoint, and moves it aside when done. The app
// parses the invoice and surfaces its line items under "MYOB Invoices" for you
// to turn into counts. See MYOB_IMPORT.md for setup.
//
// Usage:
//   node scripts/myob-watch.mjs [folder]
//   APP_URL=https://your-app.vercel.app node scripts/myob-watch.mjs ~/MYOB/invoices
//
// Config (env or flags):
//   APP_URL                  Base URL of the deployed app (default http://localhost:3000)
//   INVOICE_IMPORT_TOKEN     Must match the server's token, if one is set
//   INVOICE_IMPORT_ACCOUNT_ID Account to deliver to (default: server default)
//   POLL_MS                  Poll interval in ms (default 4000)
//   --once                   Process whatever is there now, then exit

import { readFile, readdir, rename, mkdir, stat, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const ARGS = process.argv.slice(2);
const ONCE = ARGS.includes("--once");
const WATCH_DIR =
  ARGS.find((a) => !a.startsWith("--")) ||
  process.env.MYOB_WATCH_DIR ||
  "./myob-invoices";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const ENDPOINT = `${APP_URL}/api/invoice`;
const TOKEN = process.env.INVOICE_IMPORT_TOKEN || "";
const ACCOUNT_ID = process.env.INVOICE_IMPORT_ACCOUNT_ID || "";
const POLL_MS = Number(process.env.POLL_MS || 4000);

const EXT_MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const PROCESSED_DIR = join(WATCH_DIR, "processed");
const FAILED_DIR = join(WATCH_DIR, "failed");

// Files seen in the previous poll, mapped to their size, so we only upload a
// file once it has stopped growing (i.e. the copy into the folder finished).
const sizes = new Map();
const inFlight = new Set();

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

async function ensureDirs() {
  await mkdir(WATCH_DIR, { recursive: true });
  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(FAILED_DIR, { recursive: true });
}

async function uploadFile(name) {
  const full = join(WATCH_DIR, name);
  const mimeType = EXT_MIME[extname(name).toLowerCase()];
  if (!mimeType) return; // not an invoice file

  const buf = await readFile(full);
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filename: name,
        mimeType,
        dataBase64: buf.toString("base64"),
        ...(ACCOUNT_ID ? { accountId: ACCOUNT_ID } : {}),
      }),
    });
  } catch (e) {
    // Network error — leave the file in place and retry next poll.
    log(`! ${name}: network error (${e.message}); will retry`);
    return;
  }

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text.slice(0, 200) };
  }

  if (res.ok) {
    await rename(full, join(PROCESSED_DIR, name));
    sizes.delete(name);
    log(
      `✓ ${name}: ${payload.lineCount} lines, ${payload.totalQuantity} units` +
        (payload.invoiceNumber ? ` (Invoice ${payload.invoiceNumber})` : "")
    );
    return;
  }

  // 429 / 5xx are transient — keep the file for the next cycle.
  if (res.status === 429 || res.status >= 500) {
    log(`! ${name}: ${res.status} ${payload.error || ""} ${payload.message || ""}; will retry`);
    return;
  }

  // 4xx (bad request / unauthorized / unreadable) won't fix on retry — set aside.
  await rename(full, join(FAILED_DIR, name));
  await writeFile(
    join(FAILED_DIR, `${name}.error.txt`),
    `HTTP ${res.status}\n${payload.error || ""}: ${payload.message || ""}\n`
  );
  sizes.delete(name);
  log(`✗ ${name}: ${res.status} ${payload.error || ""} ${payload.message || ""} -> failed/`);
}

async function poll() {
  let entries;
  try {
    entries = await readdir(WATCH_DIR, { withFileTypes: true });
  } catch (e) {
    log(`! cannot read ${WATCH_DIR}: ${e.message}`);
    return;
  }

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (name.startsWith(".")) continue;
    if (!(extname(name).toLowerCase() in EXT_MIME)) continue;
    if (inFlight.has(name)) continue;

    let size;
    try {
      size = (await stat(join(WATCH_DIR, name))).size;
    } catch {
      continue;
    }

    const prev = sizes.get(name);
    sizes.set(name, size);
    // Upload only once the size is stable across two polls (copy finished).
    if (prev === undefined || prev !== size) continue;

    inFlight.add(name);
    uploadFile(name)
      .catch((e) => log(`! ${name}: ${e.message}`))
      .finally(() => inFlight.delete(name));
  }
}

async function main() {
  await ensureDirs();
  log(`Watching ${WATCH_DIR} -> ${ENDPOINT}${TOKEN ? " (token set)" : ""}`);
  if (ONCE) {
    // Two passes so the stability check can clear on already-present files.
    await poll();
    await new Promise((r) => setTimeout(r, 1200));
    await poll();
    // Give in-flight uploads a moment to finish.
    await new Promise((r) => setTimeout(r, 1500));
    return;
  }
  await poll();
  setInterval(poll, POLL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
