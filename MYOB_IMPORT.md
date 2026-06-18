# MYOB invoice import

Drop a MYOB invoice into a watched folder and its line items show up in the app
as a stocktake-ready count, so you don't re-key what an invoice already lists.

```
MYOB invoice PDF
  └─► watched folder ──(scripts/myob-watch.mjs)──► POST /api/invoice
                                                       │  Gemini reads the invoice
                                                       ▼
                                              Supabase  sync_records
                                                       │  syncs to every device
                                                       ▼
                                        App ▸ "MYOB Invoices" ▸ review
                                                       │  match SKUs → catalog
                                                       ▼
                                            count entries in a session
```

## What it does

- The **watcher** uploads each new invoice file (PDF / image) to the app's
  `/api/invoice` route, then moves it into `processed/` (or `failed/`).
- The **route** uses Gemini (the same key as AI Scan) to read the invoice into
  structured line items — item code, description, quantity, unit price — and
  writes them to Supabase as a `pending` invoice import.
- The app shows pending invoices under **MYOB Invoices** (Home screen). You
  review the lines: matched SKUs become **count entries** in a session; new SKUs
  can be added to your catalog with one tap, then counted.

Matching, item creation, and writing counts all happen in the app — nothing is
written to your books and MYOB is never modified. This is a one-way read.

## Prerequisites

1. **Gemini** configured on the server — same `GEMINI_API_KEY` as AI Scan
   (see `SECRETS.md`).
2. **Supabase sync** configured — `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `SUPABASE_SETUP.md`). This is the
   delivery channel; without it the route returns `not_delivered`.
3. The review screen is shown only when `NEXT_PUBLIC_MYOB_IMPORT_ENABLED=1`.

## Server env

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Reads the invoice (server-side, never shipped to the phone). |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Delivers parsed invoices to the app. |
| `NEXT_PUBLIC_MYOB_IMPORT_ENABLED` | `1` shows the MYOB Invoices screen. |
| `INVOICE_IMPORT_TOKEN` | Optional shared secret the watcher must send. |
| `INVOICE_IMPORT_ACCOUNT_ID` | Account to deliver to (default `dev-shared-account`). |
| `INVOICE_MOCK` | `1` returns a canned invoice without calling Gemini (testing). |

## Running the watcher

On the computer where MYOB saves invoices:

```bash
# Watch ./myob-invoices, talk to your deployment:
APP_URL=https://your-app.vercel.app \
INVOICE_IMPORT_TOKEN=the-same-token-as-the-server \
npm run myob:watch -- ~/MYOB/invoices
```

Or directly:

```bash
node scripts/myob-watch.mjs ~/MYOB/invoices
```

Config (env or flags):

| Setting | Default | Notes |
| --- | --- | --- |
| folder (1st arg) / `MYOB_WATCH_DIR` | `./myob-invoices` | Where MYOB drops invoices. |
| `APP_URL` | `http://localhost:3000` | Base URL of the app. |
| `INVOICE_IMPORT_TOKEN` | _(none)_ | Must match the server's token if set. |
| `INVOICE_IMPORT_ACCOUNT_ID` | server default | Override the target account. |
| `POLL_MS` | `4000` | Folder poll interval. |
| `--once` | — | Process current files then exit (handy for cron). |

The watcher creates `processed/` and `failed/` inside the folder:

- **2xx** → file moved to `processed/`.
- **4xx** (bad file, wrong token, unreadable) → moved to `failed/` with a
  `.error.txt` note; it won't be retried.
- **429 / 5xx / network** → left in place and retried on the next poll.

A file is only uploaded once its size is stable across two polls, so a
half-copied PDF is never sent.

Accepted file types: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`.

## Reviewing in the app

1. Open the app → **MYOB Invoices** (a card also appears on Home when invoices
   are waiting).
2. Open an invoice. Each line shows whether its SKU matched a catalog item.
   - **Matched** lines are ready to count.
   - **Unmatched** lines get a **Create item** button (prefilled from the
     invoice) — tap it and the line matches.
3. Tap **Add counts**. Matched lines become count entries in your active
   session (or a new `MYOB …` session if none is active), with the invoice
   number as the entry location so you can trace each number back on export.
4. Re-running an import never double-counts: already-imported lines are skipped.

## Testing without MYOB or Gemini

```bash
# Server: canned invoice, no Gemini needed (Supabase still required to deliver)
INVOICE_MOCK=1 npm run start

# Drop any file and run one pass
mkdir -p myob-invoices && echo test > myob-invoices/demo.pdf
node scripts/myob-watch.mjs myob-invoices --once
```
