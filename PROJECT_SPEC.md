# Warehouse Inventory Counting App — Project Spec

## 1. Problem

I work in a warehouse that sells storage bins (various colors and sizes) and matching lids. When stocktaking, I walk the warehouse with a printed Excel sheet and a pen, counting items and writing quantities by hand.

**The core pain:** the same item often appears in multiple physical locations. Today I have to either keep rewriting numbers for the same item or do messy arithmetic in the margin. It's slow and error-prone.

## 2. Goal

Build a **mobile-first web app** that lets me:

1. Walk the warehouse with my phone.
2. Search for an item, enter a quantity and location, tap "Add Count."
3. Have the app automatically aggregate multiple counts for the same item across locations.
4. Export a clean spreadsheet at the end of the session.

The app should replace the paper process entirely.

## 3. Core Design Principle

**The app is item-centric, not row-centric.**

- I create each product **once** in a master item database.
- I add **many** count entries against that item during a stocktake.
- The app sums the counts — I never edit a spreadsheet row directly.

Bad mental model:

> "Every time I count something, I create a new spreadsheet row manually."

Good mental model:

> "I select an item, add a count, and the app handles the spreadsheet for me."

This is the entire value of the app.

## 4. Data Model

Three tables.

### `items` — master product catalog

| Field              | Example                  |
| ------------------ | ------------------------ |
| `id`               | `1`                      |
| `name`             | `60L Storage Bin`        |
| `sku`              | `BIN-60-BLK`             |
| `category`         | `Bin`                    |
| `color`            | `Black`                  |
| `size`             | `60L`                    |
| `photo_url`        | image of the bin         |
| `matching_lid_sku` | `LID-60-BLK`             |
| `notes`            | "Stacked near loading bay" |

Each product exists exactly once. Photos help me confirm I'm counting the right item.

### `count_sessions` — each stocktake

| Field        | Example                 |
| ------------ | ----------------------- |
| `id`         | `1`                     |
| `name`       | `May Stocktake`         |
| `created_at` | `2026-05-27`            |
| `status`     | `in_progress` / `completed` |
| `counted_by` | `Max`                   |

Why sessions matter: I'll stocktake monthly, and old counts must not mix with new counts.

### `count_entries` — every individual count

| Field        | Example         |
| ------------ | --------------- |
| `id`         | `1`             |
| `session_id` | `1`             |
| `item_id`    | `1`             |
| `quantity`   | `12`            |
| `location`   | `Aisle 3`       |
| `created_at` | `2026-05-27T14:22` |
| `notes`      | optional        |

**Multiple entries per (session, item) are expected and required** — that's how I solve the "same item in multiple places" problem.

Example for one item in one session:

| Item          | Location  | Quantity |
| ------------- | --------- | -------: |
| Black 60L Bin | Aisle 3   |       12 |
| Black 60L Bin | Back wall |       20 |
| Black 60L Bin | Top shelf |       72 |

Total: **104** — calculated, never stored.

## 5. MVP Feature Scope (v1)

Build only these:

1. Add / edit / import inventory items with photos.
2. Start a stocktake session.
3. Search and select an item on the phone.
4. Enter quantity + location, tap "Add Count" → entry is appended (never overwritten).
5. Show running total per item within the session.
6. Show count history per item with **edit and delete** — counting mistakes happen, undo is essential.
7. Export spreadsheet with two sheets (see §8).

Anything not on this list is v2 or later.

## 6. Screens

### Screen 1: Home

Active stocktake sessions and the main actions.

```
Start New Count
Continue Count
Export Spreadsheet
Manage Items
```

### Screen 2: Count Items (the most important screen)

```
Search item...
[Photo] 60L Bin - Black
[Photo] 60L Lid - Black
[Photo] 80L Bin - Blue
```

Tap an item to open the count panel:

```
60L Bin - Black
Photo
SKU: BIN-60-BLK
Current total in this session: 84

Quantity found:   [  24 ]
Location:         [ Aisle 2 ]
[ Add Count ]
```

### Screen 3: Item Detail

```
60L Bin - Black

Total counted: 104

Count history:
  Aisle 3    — 12   [edit] [delete]
  Back wall  — 20   [edit] [delete]
  Top shelf  — 72   [edit] [delete]
```

### Screen 4: Manage Items

CRUD for the master product catalog. Fields: name, SKU, category, color, size, photo, matching lid SKU.

Should also support **importing the existing Excel product list** so I don't have to manually create every item.

## 7. Tech Stack

Mobile-first web app — no native app needed. Runs in the phone browser and can be added to the home screen as a PWA.

| Layer           | Choice                                  |
| --------------- | --------------------------------------- |
| Frontend        | Next.js (App Router) + React + Tailwind |
| Hosting         | Vercel                                  |
| Database        | Supabase (Postgres)                     |
| Photo storage   | Supabase Storage                        |
| Auth (optional) | Supabase Auth                           |
| Export          | CSV / XLSX generation (e.g. `xlsx` lib) |

Why this stack:

- **Vercel + Next.js**: zero-config deployment, instant preview URLs, mobile-friendly.
- **Supabase**: real Postgres database, file storage for photos, optional auth — all in one. Avoids the "my data is trapped in localStorage" problem.
- **PWA**: feels like an app on the phone but ships as a website.

## 8. Spreadsheet Export Format

Export to `.xlsx` with two sheets.

### Sheet 1 — Summary

One row per item.

| SKU        | Item    | Color | Size | Total Count |
| ---------- | ------- | ----- | ---- | ----------: |
| BIN-60-BLK | 60L Bin | Black | 60L  |         104 |
| LID-60-BLK | 60L Lid | Black | 60L  |          97 |

### Sheet 2 — Detailed Counts

One row per `count_entry`.

| Date       | Item          | SKU        | Location  | Quantity | Counted By |
| ---------- | ------------- | ---------- | --------- | -------: | ---------- |
| 2026-05-27 | 60L Bin Black | BIN-60-BLK | Aisle 3   |       12 | Max        |
| 2026-05-27 | 60L Bin Black | BIN-60-BLK | Back wall |       20 | Max        |

Detailed sheet matters because it lets me trace where any number came from later.

## 9. Target User Flow

The whole app should optimize for this loop:

```
Open app
→ Tap "May Stocktake"
→ Search "black bin"
→ Tap "60L Bin - Black"
→ See photo to confirm
→ Enter 24
→ Choose "Aisle 2"
→ Tap "Add Count"
→ "Added. Total now 84."
→ Next item
→ ...
→ Tap "Export Spreadsheet" at the end
```

If any step in this loop is slow or clumsy on a phone, fix it before adding new features.

## 10. Out of Scope for v1

Explicitly **not** building these yet:

- Barcode / QR code scanning
- Fixed-location picker buttons (free-text location is fine for v1)
- Expected vs. counted reconciliation report
- Multi-user accounts and role-based access
- Real-time collaboration between multiple counters
- Fancy design / animation polish

## 11. Future Enhancements (v2+)

In rough priority order:

1. **Barcode / QR scanning** — scan an item to open its count page instantly.
2. **Location buttons** — predefined locations (Aisle 1–N, Back Wall, Mezzanine, Loading Bay) instead of typing.
3. **Expected vs. counted view** — upload expected stock and show variance.

   | Item          | Expected | Counted | Difference |
   | ------------- | -------: | ------: | ---------: |
   | Black 60L Bin |      120 |     104 |        -16 |

4. **Multi-user counting** — multiple people counting different warehouse areas in the same session.
5. **History across sessions** — trend lines for stock levels over time.

## 12. Design Priorities

In order:

1. **Speed of counting on a phone with one hand.** Everything else is secondary.
2. **Correctness** — count entries are append-only, edits are explicit, undo is always available.
3. **Photos visible at decision points** — never count blind.
4. **Export quality** — the spreadsheet has to be usable by anyone, not just me.
5. **Visual polish** — last. Ugly-but-useful is the v1 bar.
