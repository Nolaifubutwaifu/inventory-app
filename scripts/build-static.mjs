#!/usr/bin/env node
// Builds the app for static export (Capacitor / iOS).
// Moves app/api aside during the build because Route Handlers that read
// `request.json()` aren't supported with `output: "export"`. The scan API is
// hosted separately (Vercel) and pointed at via NEXT_PUBLIC_API_BASE.
import { spawn } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "app/api");
const tmpDir = join(root, ".api-static-build-tmp");

let moved = false;
function restore() {
  if (moved && existsSync(tmpDir)) {
    renameSync(tmpDir, apiDir);
    moved = false;
  }
}
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});
process.on("uncaughtException", (e) => {
  restore();
  console.error(e);
  process.exit(1);
});

if (existsSync(apiDir)) {
  renameSync(apiDir, tmpDir);
  moved = true;
}

const child = spawn("next", ["build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_STATIC_EXPORT: "1" },
  shell: false,
});

child.on("exit", (code, signal) => {
  restore();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
