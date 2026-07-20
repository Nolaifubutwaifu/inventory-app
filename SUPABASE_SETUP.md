# Cross-device sync (Supabase)

The app is local-first (IndexedDB on each device). Turning on Supabase makes
every device on the same account share its items, sessions, counts, and
location templates in real time. Without the two env vars below, the app runs
exactly as before — fully local, no sync.

## How it works

- One generic table, `sync_records`, mirrors all four local tables. Each row is
  `{ collection, id, account_id, data (jsonb), deleted, updated_at }`.
- **Outbound:** Dexie write hooks push every local create/update/delete to
  Supabase ([lib/sync/engine.ts](lib/sync/engine.ts)). Deletes upload only a
  minimal tombstone (id, no payload) so dead data never bloats the table.
- **Inbound:** a Supabase realtime subscription writes remote changes back into
  IndexedDB, and the app's `useLiveQuery` views re-render automatically.
- **Catch-up on load:** each device remembers the newest server change it has
  applied and pulls only rows changed since (plus a lightweight id index), so
  reopening the app stays fast no matter how large the catalog grows.
- The account key is the signed-in user id. While the dev auth bypass is on,
  that's the fixed id `dev-shared-account`, so **all devices share one account**
  — which is exactly the testing setup you asked for.

## One-time setup

### 1. Create a Supabase project
Go to https://supabase.com → New project. Wait for it to provision.

### 2. Create the table + policies
Open **SQL Editor** in the Supabase dashboard, paste this, and run it:

```sql
create table if not exists public.sync_records (
  collection  text    not null,
  id          text    not null,
  account_id  text    not null,
  data        jsonb   not null,
  deleted     boolean not null default false,
  updated_at  bigint  not null,
  primary key (collection, id)
);

create index if not exists sync_records_account_idx
  on public.sync_records (account_id);

alter table public.sync_records enable row level security;

-- TESTING policy: the anon key can read/write everything. This matches the
-- current "one shared account, no login" setup. Tighten this with real auth
-- (e.g. account_id = auth.jwt() claim) before any real multi-tenant use.
drop policy if exists "sync_records anon all" on public.sync_records;
create policy "sync_records anon all" on public.sync_records
  for all to anon using (true) with check (true);

-- Deliver row changes over realtime.
alter publication supabase_realtime add table public.sync_records;
```

### 3. Grab your keys
Supabase dashboard → **Project Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Set the env vars
- **Local:** copy `.env.local.example` to `.env.local` and fill both in, then
  restart `npm run dev`.
- **Vercel:** Project → Settings → Environment Variables → add both for
  Production (and Preview if you want). These are `NEXT_PUBLIC_` values baked in
  at build time, so **redeploy** after adding them.

That's it. Create an item on one device; it appears on the others within a
second.

## Security note

With the dev bypass + the permissive `anon` policy above, anyone with the site
URL reads/writes the shared account. That's intended for testing only. For
production: turn off `DEV_AUTH_BYPASS` in [lib/auth.ts](lib/auth.ts), wire real
auth, and replace the policy with one that scopes `account_id` to the
authenticated user/org.
