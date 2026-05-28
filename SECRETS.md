# SECRETS — read this before changing your API key

> **The Gemini API key lives in TWO places.** If you change it in one and forget
> the other, the app will break in confusing ways (dev works / production
> fails, or vice versa). This file is the single source of truth for where it
> lives and how to update it.

---

## What the key is

| Variable | Used by | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server-side only (the `/api/scan` route). | Never bundled into the iOS app — the phone never sees this. |
| `GOOGLE_GEMINI_BASE_URL` | Server-side only. Points the Gemini SDK at a proxy (currently a Data Annotation `/api/llm_proxy/gemini` URL). | Leave blank to call Google directly. |
| `NEXT_PUBLIC_AI_SCAN_ENABLED` | Client (decides whether the Scan FAB appears). | `1` = show, anything else = hide. Public, not a secret. |
| `NEXT_PUBLIC_API_BASE` | Baked into the iOS bundle at build time. The phone sends scan requests here. | Points at the Vercel deployment in production. |

The thing you usually want to rotate is **`GEMINI_API_KEY`**. The two places
that copy live:

1. `inventory-app/.env.local` on this laptop — used by `npm run dev`.
2. Vercel project env (`couple-app-s-projects/inventory-app`) — used by
   the deployed `/api/scan` on
   `https://inventory-app-eight-rose.vercel.app`.

---

## Rotating `GEMINI_API_KEY`

Do **both** steps. Order doesn't matter.

### 1. Update the local `.env.local`

Open `inventory-app/.env.local` in any editor and replace the line:

```
GEMINI_API_KEY=<old-value>
```

with:

```
GEMINI_API_KEY=<new-value>
```

Save. Then **restart `npm run dev`** if it's running — Next.js only reads
`.env.local` at startup.

### 2. Update Vercel production env

From the project directory:

```bash
cd "/Users/maximilianumschaden/Desktop/EVERYTHING WITH CODE/inventory-app"
npx vercel env rm GEMINI_API_KEY production
printf "<NEW-KEY-VALUE>" | npx vercel env add GEMINI_API_KEY production
npx vercel --prod --yes
```

The `printf` (no trailing newline) is important — `echo` adds a `\n` that gets
included in the env value and breaks the API call.

The final `vercel --prod --yes` redeploys so the new key is picked up
**immediately**. Without it, the change only takes effect on the *next* git
push to main.

### 3. Verify

```bash
# Local
curl -s -X POST http://localhost:3000/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"queryImage":"data:image/jpeg;base64,xx","items":[{"id":"x","sku":"x","name":"x","referencePhotos":["data:image/jpeg;base64,xx"]}]}'

# Production
curl -s -X POST https://inventory-app-eight-rose.vercel.app/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"queryImage":"data:image/jpeg;base64,xx","items":[{"id":"x","sku":"x","name":"x","referencePhotos":["data:image/jpeg;base64,xx"]}]}'
```

Both should return JSON. If you get `{"error":"missing_key", ...}` (503), the
key didn't take effect. If you get `{"error":"model_error", ...}` the key was
read but Gemini rejected it (wrong value).

---

## Changing the Gemini base URL (Data Annotation proxy)

Same procedure, replace `GEMINI_API_KEY` with `GOOGLE_GEMINI_BASE_URL`:

```bash
# Local: edit .env.local, restart `npm run dev`
# Vercel:
cd "/Users/maximilianumschaden/Desktop/EVERYTHING WITH CODE/inventory-app"
npx vercel env rm GOOGLE_GEMINI_BASE_URL production
printf "https://your-new-proxy.example.com/path" | npx vercel env add GOOGLE_GEMINI_BASE_URL production
npx vercel --prod --yes
```

Unset entirely (= call Google directly) by removing the var on Vercel and
deleting the line from `.env.local`.

---

## Changing the URL the iPhone calls (`NEXT_PUBLIC_API_BASE`)

This one IS baked into the iOS bundle. You have to rebuild and re-sync the
native project after changing it.

```bash
cd "/Users/maximilianumschaden/Desktop/EVERYTHING WITH CODE/inventory-app"

# 1. Edit .env.local — set NEXT_PUBLIC_API_BASE to the new URL.
#    e.g. https://inventory-app-eight-rose.vercel.app

# 2. Rebuild + push the new bundle into ios/App/App/public
npm run build:static
npx cap sync ios

# 3. In Xcode (already-open workspace), hit Cmd+R to reinstall on the
#    simulator/device.
```

---

## If the key leaks (compromise scenario)

If you accidentally commit the key, paste it in chat, push to a public repo,
etc.:

1. **Get a new key first** (Data Annotation portal or
   <https://aistudio.google.com/apikey>). Do this BEFORE invalidating the old
   one so you have something to swap in.
2. **Rotate** using the steps above — both `.env.local` and Vercel.
3. **Invalidate the old key** in the issuer portal (Data Annotation /
   AI Studio) so the leaked value stops working.
4. If you committed the key to git: the commit history will keep it forever
   even after editing the file. You'd need to rewrite history
   (`git filter-repo`) and force-push, OR just accept the rotation and move
   on.

---

## What is NOT a secret

- The whole `out/` static export bundle — safe to ship to the iPhone, contains
  no keys.
- `.env.local.example` — committed, no real values.
- `capacitor.config.ts`, `next.config.ts` — both safe.
- The Vercel URL itself — public.
- `NEXT_PUBLIC_*` vars in general — these get bundled into client JS by
  design; never put a real secret behind a `NEXT_PUBLIC_` prefix.

---

## File locations summary (for `cmd-f` later)

```
.env.local                            ← key lives here for `npm run dev`
Vercel project env (couple-app-s/)    ← key lives here for production
ios/App/App/public/                   ← rebuilt by `npx cap sync ios`,
                                        contains NEXT_PUBLIC_API_BASE only
```
