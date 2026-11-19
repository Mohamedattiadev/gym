# Optional account for Gym: Sign in with Google + Supabase backup

Prepared 2026-11-19 from the working Fluent365 implementation (repo `fluent365`: `apps/pocket/src/lib/account.ts`,
`supa.ts`, `sync.ts`, `components/Account.tsx`, `e2e/account.e2e.ts`, `supabase/schema.sql`,
`.github/workflows/supabase-keepalive.yml`, `docs/SUPABASE_SETUP.md`). Read those first: most of it ports directly.

Part A is for the owner (setup, ~10 minutes once Fluent365's setup is done). Part B is the build brief for the session
that implements it. Status: **✅ built (Q11, 2026-11-19) — waiting for the owner's Part A steps.** Until the two repo
Variables exist the live site serves the committed `app/supabase-config.json` = `{}` and the Account card stays hidden.

### What was built (differences from the brief below)
- `app/js/cloud.js`, **no supabase-js**: OAuth PKCE (`/auth/v1/authorize` with `code_challenge_method=s256` →
  `?code=` → `POST /auth/v1/token?grant_type=pkce`), refresh (`grant_type=refresh_token`) and PostgREST calls over
  plain `fetch`, like `sync.js` (no 60 kB vendor file, nothing to keep up to date). Session in IndexedDB key `cloud`
  (stripped from Export, the GitHub backup, the localStorage fallback and imports).
- Table `gym_backups` gets a **`rev` column** (`supabase/gym-schema.sql` — run that file, not the SQL in Part B §2):
  writes are `PATCH … where rev = <read rev>`; a lost race reads again and merges, so two phones never overwrite each
  other. `data` = the same JSON as Export, merged with `sync.js merge()` (ids, tombstones, notes by edit time,
  newer-schema refusal BE-6).
- When it syncs: right after sign-in (empty phone = restore, else merge + upload), 20 s after a change, when the app
  comes back to the front (at most once a minute), when back online.
- **Delete my cloud data** deletes only the Gym row (+ signs out; the phone keeps its data). The Google sign-in user is
  NOT deleted on purpose: the Supabase project is shared with Fluent365 and `on delete cascade` would delete the
  Fluent365 data too. The privacy page (`#/privacy`) says how to ask for the sign-in itself to be removed.
- Config: `app/supabase-config.json` is committed as `{}` (no 404 in the console); `pages.yml` overwrites it with `jq` from `vars.SUPABASE_URL` / `vars.SUPABASE_ANON_KEY`
  (only `https://<ref>.supabase.co`) and adds that URL to the CSP `connect-src` in `index.html`. The service worker never
  caches the config.
- Tests: `tools/test/unit/cloud.test.mjs` (fake REST: upload, restore, merge with rev, conflict retry, newer schema,
  token refresh / dead refresh token, delete) and `node tools/test/cloud.mjs <outDir>` (real app + fake Supabase on the
  same origin, two fresh browser profiles: sign in → row, second phone restores, delete → row gone, signed out).

---

## Part A: owner setup (reuse Fluent365's Supabase project)

**One Supabase project and one Google OAuth client serve both apps.** Each app has its own table, and the
free plan's ~1-week pause is prevented once, by Fluent365's keep-alive workflow (it pings the same project).
Doing a second project would mean a second Google client, a second keep-alive and the free plan's 2-project limit.

Prerequisite: `fluent365/docs/SUPABASE_SETUP.md` steps 1–5 are done (project, Google client, Google provider on).

1. **Table:** Supabase → **SQL Editor** → **New query** → paste all of `supabase/gym-schema.sql` (in this repo) → **Run**.
   *You should see:* "Success. No rows returned"; **Table Editor** shows `gym_backups` with **RLS enabled**.
2. **Redirect URL:** Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL**:
   `https://mohamedattiadev.github.io/gym/**` → **Save**. Leave **Site URL** as Fluent365's address.
   *You should see:* both Pages addresses in the list.
3. **Google:** nothing new in Google Cloud (the redirect URI is Supabase's callback, the same for both apps).
   Only check that the consent screen's **App name** is neutral (e.g. `My apps`), because Google shows it on the
   sign-in page of both apps: Google Cloud → **Google Auth Platform** → **Branding** → App name → **Save**.
   Also **Authorized JavaScript origins** already has `https://mohamedattiadev.github.io` (same origin for both).
4. **Repo Variables (repo `gym`):** GitHub → `gym` → **Settings** → **Secrets and variables** → **Actions** →
   **Variables** → add `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the **same values** as in `fluent365`
   (publishable / anon public key; never the secret / service_role key). Then **Actions** → **Deploy to GitHub Pages** → **Run workflow**.
   *You should see:* in the app, **Me → Settings → Account** with "Sign in with Google".
5. **Phone check:** sign in on the phone → **Back up now** → in Supabase **Table Editor → gym_backups** one row appears;
   open the app in a private window on the laptop, sign in → it restores by itself.

The same Google account gives the same user id in both apps; each app only reads its own table.

---

## Part B: build brief (for the implementing session)

Follow Gym's own rules (`PLAN.md`, `NEXT_SESSION.md`): vanilla ES modules, no build step, `app/` is published as is,
en/tr/ar via `app/js/i18n.js`, bump `sw.js` VERSION, `tools/test/fast.sh` + unit tests + browser tests green.

### 1. Scope (same as Fluent365, adapted)
- Opt-in only; the app works fully without an account; the GitHub backup (`app/js/sync.js`) stays.
- Settings → **Account**: "Sign in with Google", signed-in email, "Back up now", "Last backup", "Restore from my account",
  "Sign out", "Delete my cloud data" (type DELETE → delete the row → sign out; local data stays).
- Hidden when there is no config.

### 2. SQL (also save it in the repo as `supabase/gym-schema.sql`)
```sql
create table if not exists public.gym_backups (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.gym_backups enable row level security;
drop policy if exists "own gym backup: select" on public.gym_backups;
drop policy if exists "own gym backup: insert" on public.gym_backups;
drop policy if exists "own gym backup: update" on public.gym_backups;
drop policy if exists "own gym backup: delete" on public.gym_backups;
create policy "own gym backup: select" on public.gym_backups for select to authenticated using (user_id = auth.uid());
create policy "own gym backup: insert" on public.gym_backups for insert to authenticated with check (user_id = auth.uid());
create policy "own gym backup: update" on public.gym_backups for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own gym backup: delete" on public.gym_backups for delete to authenticated using (user_id = auth.uid());
revoke all on public.gym_backups from anon;
grant select, insert, update, delete on public.gym_backups to authenticated;
```
`public.keepalive()` already exists (Fluent365's schema); Gym needs no keep-alive of its own.
If Gym ever gets its **own** project, copy Fluent365's `keepalive()` SQL and `supabase-keepalive.yml` (change the Variable names).

### 3. Config without a build step
- The Pages workflow writes `app/supabase-config.json` before `upload-pages-artifact`, from `vars.SUPABASE_URL` /
  `vars.SUPABASE_ANON_KEY`; when empty it writes `{}`. Use `jq -n --arg url "$URL" --arg key "$KEY" '{url:$url,key:$key}'`
  (no shell interpolation into JSON). The file is git-ignored; locally it is absent → feature hidden.
- The app fetches `./supabase-config.json` (relative path) at start; a missing file / `{}` → hidden.
  Validate: `https://` URL without path, non-empty key. Keep it out of the service worker's precache list or
  give it network-first, so a later Variables change shows up.
- Optional "Use my own Supabase" field (URL + anon key, saved in IndexedDB) overrides it, like Fluent365.

### 4. supabase-js without a bundler
- Vendor the ESM build, pinned: `@supabase/supabase-js@2.119.0` (MIT) as `app/vendor/supabase/supabase.js`
  (e.g. `npx esbuild` once: `--bundle --format=esm --minify` from the npm package, committed like `vendor/three`).
  No CDN at runtime. Add the licence to `app/vendor/licenses/` and to the About credits.
- `import()` it only when Account is opened or the device is signed in (main bundle unchanged; ~227 kB raw / ~60 kB gzip).
- Client options (this is what works in Fluent365):
  `createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storage: <IndexedDB adapter>, storageKey: "gym-auth" } })`.
  The storage adapter keeps the session in IndexedDB (async getItem/setItem/removeItem); never in the backup file.

### 5. Sign-in redirect with Gym's hash routes (the tricky part)
- Before `signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } })`,
  save `{ pending: location.hash }` in IndexedDB. Do **not** put the hash in `redirectTo`.
- At start: if `?code=` is in `location.search` and `pending` is set → `history.replaceState(null, "", location.pathname + pending)`
  first, then `exchangeCodeForSession(code)`, then the first sync (§6). Re-render the route afterwards.
- Implicit flow puts tokens in the `#` and breaks hash routing: keep PKCE.

### 6. Sync rules: reuse Gym's merge, don't duplicate it
- Payload: `buildBackup()` from `sync.js` (already strips the token and device-only state).
- Gym's GitHub backup already **merges** (`merge(local, remote)` with ids, tombstones, notes, bodyweight). Use the same
  `merge()` for Supabase: pull row → `merge(local, remote)` → apply → upsert. That is better than Fluent365's
  "newest wins" (Fluent365 has no item merge).
- Split `sync.js` into a transport-independent core (merge, payload, debounce/auto, status, "dirty") and two transports
  (GitHub contents API; Supabase row). Both share Gym's auto rule (~20 s after a change + when back online) — or, to keep
  Supabase traffic low, debounce longer; decide with the owner only if it matters.
- First sign-in on a device: nothing in the cloud → upload; empty device → restore by itself; both have data → with a
  merge there is nothing to ask: merge and upload. (Fluent365 had to ask because it cannot merge.)
- Upsert: `from("gym_backups").upsert({ user_id, data, updated_at: new Date().toISOString() })`;
  read: `.select("data, updated_at").eq("user_id", id).maybeSingle()`; delete: `.delete().eq("user_id", id)`;
  sign out: `auth.signOut({ scope: "local" })`.

### 7. Tests (patterns that worked in Fluent365)
- Unit: config missing → hidden; own config wins; first sync (empty device restores; both sides → merged; nothing remote → upload);
  delete → row gone → signed out; throttle/debounce. Inject a fake client (Fluent365: `setClientForTests`).
- Browser test with Supabase mocked by `page.route("https://<fake>.supabase.co/**")` (Fluent365 `e2e/account.e2e.ts`):
  - `/auth/v1/authorize` → HTML page that does `location.replace(redirect_to + "?code=e2e")` (more reliable than a 302);
  - `POST /auth/v1/token?grant_type=pkce` → session JSON (`access_token` = a well-formed fake JWT with `sub`, `email`, `exp`;
    `refresh_token`, `expires_in`, `expires_at`, `user`);
  - `/rest/v1/gym_backups` GET → `[]` or `[row]` (or an object if `Accept` contains `vnd.pgrst.object`), POST → 201, DELETE → 204;
  - `POST /auth/v1/logout` → 204; answer `OPTIONS` with CORS headers; every response needs `access-control-allow-origin: *`.
  - The fake host must be the only external host the test allows.
  - Use `expect.poll` on the mock's call list, not on toasts (an earlier toast can still be visible).
- Fluent365 bug to avoid: a toast fired during start-up (after the redirect back) was lost because the toaster was not mounted
  yet; queue it.

### 8. Docs to update when built
Gym's privacy wording (README / About / PLAN), `docs/SYNC.md` (add the account option), `NEXT_SESSION.md`, this file's status,
and the phone checklist if Gym has one.
