# Showing the site to Lody (free)

## Option A — today, $0: run it on your computer and share a tunnel link

The link works only while your computer is on and the two commands below keep running.

1. One-time setup (Node 24):

   ```bash
   git clone https://github.com/Farhanx64/lodelicious && cd lodelicious   # main has everything merged
   npm ci
   cp .env.example .env
   ```

   In `.env` set:

   ```
   PAYLOAD_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   APP_ENV=staging                # must be exactly local, staging or test; anything else (or unset) behaves as the live store (D41)
   PREVIEW_ASSUME_STOCK=true      # lets Lody try the bag, checkout and Build a Basket before stock is counted
   ```

   Leave `NEXT_PUBLIC_SITE_URL` unset (or set it to the tunnel's `https://…trycloudflare.com` address
   once you have it). When it is set, the admin only works when opened at exactly that address.

2. Load the catalog and build:

   ```bash
   npm run seed:catalog
   npm run build
   NODE_ENV=production PORT=3000 NODE_OPTIONS=--max-old-space-size=768 npm run serve
   ```

3. **Before sharing anything**, open http://localhost:3000/admin and create your own account.
   The first account becomes the owner — if you share the link first, whoever opens /admin first
   gets owner access. To make that impossible, set `FIRST_OWNER_EMAIL=<your email>` in `.env` first
   (only that address can then create the first account), or create the owner from the command line
   with `OWNER_EMAIL=<email> OWNER_PASSWORD='<12+ characters>' npx payload run scripts/create-owner.ts`
   (D41). Passwords need at least 12 characters.

4. In a second terminal, start a free Cloudflare quick tunnel (no account needed; install
   `cloudflared` from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   It prints a `https://<random>.trycloudflare.com` address — send that to Lody. It changes every
   time you restart the tunnel. (ngrok works the same way but needs a free account.)

What Lody will see, with `PREVIEW_ASSUME_STOCK=true`:
- the SOUSET-PINK design with the staging banner
- real products and Clover prices
- **Add to bag → checkout** with a **"Place test order"** button
- **Build a Basket → Reserve this basket**, with the deposit and a test payment

No money moves, test orders and reservations are clearly marked in /admin → Orders, and search
engines are told not to index staging. Without that setting, shop pages say "Currently
unavailable" because no stock is counted yet. The live site (`APP_ENV=production`) keeps ordering
closed until Clover payments are connected.

To give Lody her own admin login: in /admin → Staff → Users → Create, role **Owner**, and share
the password with her privately (not over the tunnel page or email in plain text if avoidable).

## Option B — always-on staging, $0 extra: the Namecheap plan

Namecheap Stellar Business is already the chosen host, so a staging subdomain (e.g.
`staging.souset-pink.com`) costs nothing extra and rehearses the real deployment — the same
cPanel "Setup Node.js App" + Passenger setup pasto-hair uses (Node 24).

Needed from Lody first: cPanel access (or an invitation) and her OK to create the subdomain — the
PRD requires her approval for domain changes. The live site and email are not touched.

## Not recommended

- **Vercel Hobby** — free tier is for non-commercial use; this is a business site.
- **Render / Koyeb free tiers** — small memory and the SQLite database resets on every restart.
