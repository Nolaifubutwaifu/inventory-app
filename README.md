# Inventory App

A mobile-first warehouse stocktake tool. Catalog items locally, count them across
sessions, and export to spreadsheet — all offline-first via IndexedDB.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` on a phone or in DevTools mobile view.

## AI Scan (optional)

When you sell similar items that look nearly identical (e.g. bins in different
shades of green), the **Scan item** camera FAB on the Count screen will identify
the item in front of you against per-item reference photos using Google's Gemini
2.5 Flash.

### Setup

1. Get a free key at <https://aistudio.google.com/apikey>.
2. Copy `.env.local.example` → `.env.local` and paste it:
   ```
   GEMINI_API_KEY=AIza...
   NEXT_PUBLIC_AI_SCAN_ENABLED=1
   ```
   If you're using a proxy that mirrors Google's REST API (e.g. a Data
   Annotation `/api/llm_proxy/gemini` URL), also set:
   ```
   GOOGLE_GEMINI_BASE_URL=https://app.dataannotation.tech/api/llm_proxy/gemini
   ```
3. Restart `npm run dev`.
4. Add 1–4 reference photos to each item (front / side / top / label) via the
   "Reference photos for AI scan" field on the Item form.
5. Open Count → tap the blue camera FAB at bottom-right → snap the item → pick
   the right candidate from the top-3 list.

### Cost & quota

Gemini's free tier covers 10 requests/minute and 250/day — plenty for a single
stocktake. Beyond that, the FAB will show "Slow down — try again in Ns". If you
need higher limits, attach billing in Google AI Studio.

### Privacy note

Free-tier prompts to Gemini may be used by Google to improve their models. That
means your SKUs and reference photos can be logged. If your catalog is
confidential, use a paid Google Cloud project (data is not used for training on
the paid tier) or skip the scan feature.

### Test without burning quota

Add `SCAN_MOCK=1` to `.env.local` and the API route returns canned matches
without calling Gemini. Useful for UI testing.

### Turn it off

Set `NEXT_PUBLIC_AI_SCAN_ENABLED=0` (or remove the line) and the FAB disappears.
The base counting flow is unchanged.
