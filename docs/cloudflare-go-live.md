# Going live on Cloudflare

How to move the store from a Node host (SQLite file, photos on disk) to Cloudflare Workers with D1
and R2, and how to deploy after that. Background and trade-offs: `docs/decisions.md` D51.

Everything below was rehearsed on 2026-11-11 against wrangler's **local emulation** only. No real
Cloudflare resource has been created and nothing has been deployed. Steps marked **(not yet run
for real)** need a logged-in Cloudflare account and are untested against the real service.

## Before you start

- A Cloudflare account on the **Workers Paid** plan. The Worker is about 4.7 MB compressed; the
  free plan stops at 3 MB (paid: 10 MB). Check the number at any time with `npm run cf:size`.
- Node 24 and this repo with `npm ci` done.
- The old host's database file and media folder (locally `.data/lodelicious.db` and `.data/media`).
- The old host's `PAYLOAD_SECRET`. Keep the same value: order and reservation links in emails, and
  member sessions, are signed with it.

Placeholders in `wrangler.jsonc` to replace: `database_id` (in two places). The names `lodelicious`
(Worker and D1 database) and `lodelicious-media` (R2 bucket) can stay.

## First go-live, in order

All **(not yet run for real)** unless a step says "local".

1. Log in.

   ```bash
   npx wrangler login
   ```

2. Create the database and the bucket.

   ```bash
   npx wrangler d1 create lodelicious
   npx wrangler r2 bucket create lodelicious-media
   ```

   Copy the `database_id` that the first command prints into `wrangler.jsonc`, in **both** places
   marked `PLACEHOLDER`.

3. Set the secret. Wrangler offers to create the Worker if it does not exist yet; say yes.

   ```bash
   npx wrangler secret put PAYLOAD_SECRET
   ```

   If the database you are moving has no staff account yet, also set who may create the first one:
   `npx wrangler secret put FIRST_OWNER_EMAIL`. Clover and email secrets are added the same way when
   those are switched on (`CLOVER_API_TOKEN`, `SMTP_PASS`, and so on); plain settings go in
   `"vars"` in `wrangler.jsonc`.

4. Stop changes on the old host (stop the Node app, or put it in maintenance), so nothing is written
   after the copy.

5. Move the database. The export is a local step and safe to repeat; the import must go into an
   **empty** D1 database.

   ```bash
   sh scripts/export-for-d1.sh .data/lodelicious.db d1-import.sql
   npx wrangler d1 execute D1 --remote --file d1-import.sql
   npm run cf:migrate:remote      # applies any migration the old database had not seen yet
   ```

   Check a few counts against the old database, for example:

   ```bash
   sqlite3 .data/lodelicious.db "select count(*) from products; select count(*) from orders; select count(*) from media;"
   npx wrangler d1 execute D1 --remote --command "select count(*) from products; select count(*) from orders; select count(*) from media;"
   ```

   Delete `d1-import.sql` afterwards: it contains customer data and password hashes.

6. Move the photos (originals and their resized copies) into the bucket.

   ```bash
   CLOUDFLARE_ENV=remote node scripts/upload-media-to-r2.mjs .data/media
   ```

7. Build and deploy. `cf:deploy` builds with `APP_ENV=production`, which turns on the HSTS header.

   ```bash
   npm run cf:deploy
   ```

8. Smoke-test on the `workers.dev` address that the deploy prints: `/healthz`, `/`, `/shop`, a
   product photo, then log in at `/admin` and open `/ops/system-check` (every line must pass).
   The admin only logs in from an address listed in `NEXT_PUBLIC_SITE_URL` (`wrangler.jsonc`
   `"vars"`). To test on `workers.dev` before the domain moves, add that address after a comma,
   deploy, and take it out again afterwards.

9. Check the cron jobs: the Worker's settings in the Cloudflare dashboard list three cron
   triggers, and `npx wrangler tail` shows `[cron] release-expired-holds` within five minutes.

10. Domain, only with Lody's approval (it is a DNS change). The domain must use Cloudflare's
    nameservers (add the site in the Cloudflare dashboard and switch the nameservers at Namecheap,
    or transfer the domain). Then uncomment `"routes"` in `wrangler.jsonc` and run
    `npm run cf:deploy` again. Cloudflare issues the certificate.

11. Turn the old host off once the domain serves the Worker. Keep the old database file and media
    folder as the backup of the move.

## Starting empty instead (no data to move)

Seed on a Node machine and then move it as above (steps 5 and 6). Seeding straight into D1 works
(`DEPLOY_TARGET=cloudflare npm run seed:catalog`), but photos uploaded on the Cloudflare side get no
resized copies, so pages would load the full-size originals.

## Rehearsing on this machine (local, verified)

Uses wrangler's emulation in `.wrangler/state`; nothing leaves the machine and no login is needed.

```bash
cp .dev.vars.example .dev.vars            # set PAYLOAD_SECRET
rm -rf .wrangler/state                    # start from an empty local D1 and R2
sh scripts/export-for-d1.sh .data/lodelicious.db d1-import.sql
npx wrangler d1 execute D1 --local --file d1-import.sql
npm run cf:migrate
node scripts/upload-media-to-r2.mjs .data/media
npm run cf:build
npm run cf:preview                        # http://localhost:8799
```

To run a cron job by hand in the preview, start it with `npx wrangler dev --port 8799 --test-scheduled`
and open `http://localhost:8799/__scheduled?cron=*/5+*+*+*+*`.

Do not run two of these commands at the same time: they share the files in `.wrangler/state`.

## Day to day after go-live

| Task | Command |
| --- | --- |
| Deploy the current code | `npm run cf:deploy` |
| Schema change | Create the migration as always, in the default Node mode (`npx payload migrate:create <name> < /dev/null`), commit it, then `npm run cf:migrate:remote` **before** `npm run cf:deploy` |
| Run a script against the live data | `DEPLOY_TARGET=cloudflare CLOUDFLARE_ENV=remote npx payload run scripts/<name>.ts` |
| Live logs | `npx wrangler tail` |
| Back up the database | `npx wrangler d1 export lodelicious --remote --output backup.sql` (D1 also keeps 30 days of point-in-time history: `wrangler d1 time-travel`) |
| Roll back the code | `npx wrangler rollback` (the database and bucket are not rolled back) |
| Bundle size | `npm run cf:size` |

## Not verified

- Every command with `--remote`, `CLOUDFLARE_ENV=remote`, `wrangler login`, `secret put`,
  `cf:deploy`, the cron schedules firing on Cloudflare, and the custom domain: none could be run
  without an account.
- That the real D1 accepts `d1-import.sql` exactly as the emulation does. The file avoids what
  Cloudflare documents as unsupported (transactions, `PRAGMA foreign_keys`), but a production-size
  database has not been tried; very large files may need splitting.
- Request CPU time on Cloudflare. The admin's first request in a new isolate loads a large bundle;
  locally that is fast, but it has not been measured against the paid plan's limits.
- The Rate Limiting bindings on Cloudflare (they work in the emulation).
