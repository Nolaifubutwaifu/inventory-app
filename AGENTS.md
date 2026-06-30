<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Local data is the user's data — never wipe it on upgrade

User inventory data lives in on-device IndexedDB (Dexie, `lib/db.ts`), and
unless Supabase sync is configured there is **no server-side copy**. So Dexie
schema migrations must preserve existing rows.

- When bumping `this.version(N)`, write **data-preserving** `.upgrade()` steps.
  Transform rows in place; never `tx.table(...).clear()` or drop user data.
  (The historical v3 upgrade clears items/sessions/entries — do **not** copy
  that pattern. It predates the multi-user data model and only ran for pre-v3
  installs.)
- Adding indexes or new tables is safe and needs no data migration (see v4/v5).
- If a migration genuinely must restructure data, migrate it — don't delete it.
- A user-facing JSON backup/restore lives in `lib/backup.ts`; keep its
  `BackupFile` shape in sync when entity types change, and bump
  `BACKUP_VERSION` for breaking changes.
