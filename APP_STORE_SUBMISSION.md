# App Store submission — what to paste where

A field-by-field guide for App Store Connect so you can submit without
guessing. Status of each App Review checkpoint is listed in the last section.

---

## App information

| Field | Value |
|---|---|
| **Name** (max 30 chars) | `Inventory: Stocktake & Count` |
| **Subtitle** (max 30 chars) | `Phone-first warehouse counts` |
| **Primary category** | Business |
| **Secondary category** | Productivity |
| **Bundle ID** | `com.maxumschaden.inventory` *(already in xcodeproj)* |
| **SKU** | `inventory-ios-1` |
| **Privacy Policy URL** | `https://<your-vercel-domain>/privacy` |
| **Support URL** | `https://<your-vercel-domain>/support` |
| **Marketing URL** *(optional)* | leave blank, or use the same Vercel root |
| **Copyright** | `© 2026 Maximilian Umschaden` |
| **Contact info** | your email + phone (only visible to App Review) |

---

## Pricing & availability

| Field | Value |
|---|---|
| Price | Free |
| Availability | All countries / regions |
| App Store distribution | Make this app available on the App Store ✓ |
| Pre-orders | Off |

---

## App Privacy (Privacy nutrition label)

Has to match the wording in `/privacy`. Pick these answers exactly:

**Do you or your third-party partners collect data from this app?** → **Yes**

Then declare these data types as collected and **not linked** to the user
(because the only off-device transmission is the optional AI Scan and Google
Gemini does not receive an identifier):

- **Photos or Videos** — Purpose: **App Functionality**. Linked: **No**.
  Tracking: **No**. *(AI Scan sends a photo + the catalog metadata.)*
- *(Nothing else.)*

**Do you or your third-party partners use this app's data to track users?**
→ **No**.

**SDK list** → none (no analytics, no ads).

> If AI Scan is not enabled in the build you submit, declare **No data
> collected** instead.

---

## Age rating

Walk the questionnaire as a B2B/utility tool — every category answers
**None**. Result will be **4+**.

---

## Content rights

- Does your app contain, show, or access third-party content? → **No**

---

## Demo account / sign-in info

Inventory uses *local* sign-up — no server, no shared accounts. Tell App
Review this in the Review Notes (see below). Reviewers can create their own
account in <10 seconds.

---

## Review notes (paste into the "Notes" field)

```
Inventory is a stocktaking tool for warehouses and small businesses. It
runs entirely on-device; there is no remote account system. To exercise
the full flow:

1. Tap "Create account" on the first launch and enter any email, business
   name, and password (≥ 6 chars).
2. Walk through the four-screen welcome carousel.
3. The home screen shows a "Start a new stocktake" CTA and a seeded
   catalog of six demo items. Tap any item or scan one of its placeholder
   barcodes (in /Items → item detail) to log a count.
4. From the Sessions tab → open a session → tap "Export" to produce an
   Excel spreadsheet.

Optional AI Scan: a camera button on the Count screen sends the captured
photo + your catalog's item metadata to Google Gemini for image
identification. The feature is hidden unless the build's backing server
has a Gemini API key configured. The build you are reviewing [does / does
not] have AI Scan enabled — please confirm and adjust expectations.

No special hardware, login, or external account is required.
```

*(Edit the bracketed line to match the build you're submitting.)*

---

## Build & signing checklist

- [x] `PRODUCT_BUNDLE_IDENTIFIER = com.maxumschaden.inventory`
- [x] `DEVELOPMENT_TEAM = B4NT799P9U`
- [x] `TARGETED_DEVICE_FAMILY = 1` (iPhone only)
- [x] `IPHONEOS_DEPLOYMENT_TARGET = 15.0`
- [x] `UIRequiredDeviceCapabilities = ["arm64"]`
- [x] `UISupportedInterfaceOrientations = [Portrait]`
- [x] `MARKETING_VERSION = 1.0`, `CURRENT_PROJECT_VERSION = 1`
- [x] `ITSAppUsesNonExemptEncryption = false` in Info.plist
- [x] `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` set
- [x] `PrivacyInfo.xcprivacy` in the target
- [x] App Icon 1024×1024 PNG, no alpha, in `Assets.xcassets/AppIcon`
- [x] Branded launch screen storyboard
- [x] Account deletion inside the app (Account → Danger zone)
- [x] Release build: `dwarf-with-dsym`, `VALIDATE_PRODUCT = YES`
- [x] No `NSAllowsArbitraryLoads`, no debug ATS exceptions

---

## Screenshots needed

App Store Connect requires **at least one device size** per platform. For
iPhone-only, supply the 6.7" set; everything smaller is optional.

| Required | Device class | Pixel size |
|---|---|---|
| ✓ | 6.7" iPhone (15 / 16 Pro Max) | 1290 × 2796 |
| Optional | 6.5" iPhone (11 / 12 / 13 Pro Max) | 1242 × 2688 |
| Optional | 5.5" iPhone (8 Plus) | 1242 × 2208 |

3–10 screenshots per size. Suggested order:

1. Home / start a new stocktake
2. Item list with seeded catalog
3. Count screen
4. Item detail with photo and reference photos
5. Sessions list
6. Export confirmation

You already have `screenshots/*.png` from the test harness — they're 2x
phone scale, may need padding for the App Store device frame requirements.

---

## TestFlight (optional but useful before production)

1. Archive the app in Xcode (Product → Archive) with a Release scheme.
2. Distribute → App Store Connect → Upload.
3. In ASC, go to TestFlight → wait for processing (~10–30 min).
4. Add yourself as an internal tester; install the build on a real device.
5. Run through the review-notes flow at least once on hardware. *Watch for
   permission prompts firing twice or being denied silently.*
6. Once confirmed, promote the build to App Review under the "App Store"
   tab.

---

## Common rejection traps I've already mitigated

| Apple guideline | Issue | Mitigation |
|---|---|---|
| 5.1.1(v) | Apps with sign-up must support in-app account deletion | Account tab → Danger zone → Delete account (2× confirm) |
| 2.5.1 | Apps must not reference private APIs | Stock Capacitor 8.3.4 only |
| 5.1.2 | Privacy nutrition label must match privacy policy | Photos/Videos: App Functionality, Not Linked, No Tracking |
| 1.4.1 | Camera/photo descriptions must be specific | Both Info.plist usage strings are feature-specific |
| 2.3.7 | App name must be ≤ 30 chars + match the bundle | "Inventory: Stocktake & Count" (29) |
| 5.1.1(iii) | Must not gate basic features behind sign-up | The full count flow works in a fresh local account |
| 4.0 | Apps that look like web wrappers may be rejected | Native nav (BottomNav), native camera (Capacitor), gestures, splash, full offline support, IndexedDB persistence — not a web shell |

---

## Things still to do *before* submitting

- [ ] Bump `MARKETING_VERSION` if you've already tagged 1.0
- [ ] **Decide AI Scan for v1**. Recommended: ship **off** for the first
  submission (don't pass `NEXT_PUBLIC_AI_SCAN_ENABLED=1` when running
  `npm run build:static`). The reviewer sees a clean barcode-only scan
  button — no risk of a broken AI 503 on their end if the Vercel key
  isn't set right. Turn AI on in v1.1.
  - If you do ship with AI on: also set `NEXT_PUBLIC_API_BASE` to your
    Vercel root at static-build time so the iOS bundle points at it.
- [ ] App Store-ready screenshots: `npm run shot:appstore` → uploads in
  `screenshots/appstore/`
- [ ] Create the listing in App Store Connect using the values above
- [ ] Archive → Upload → submit to App Review

---

*Last refreshed: 2026-05-31.*
