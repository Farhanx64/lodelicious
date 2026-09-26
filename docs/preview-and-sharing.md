# Showing the site to Lody (free)

## Option A — today, $0: run it on your computer and share a tunnel link

The link works only while your computer is on and the two commands below keep running.

1. One-time setup (Node 24):

   ```bash
   git clone https://github.com/Farhanx64/lodelicious && cd lodelicious
   git checkout claude/sweet-meitner-2hnl84
   npm ci
   cp .env.example .env
   ```

   In `.env` set:

   ```
   PAYLOAD_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   APP_ENV=staging
   PREVIEW_ASSUME_STOCK=true      # lets Lody try Build a Basket before stock is counted
   ```

2. Load the catalog and build:

   ```bash
   npm run seed:catalog
   npm run build
   NODE_ENV=production PORT=3000 NODE_OPTIONS=--max-old-space-size=768 npm run serve
   ```

3. **Before sharing anything**, open http://localhost:3000/admin and create your own account.
   The first account becomes the owner — if you share the link first, whoever opens /admin first
   gets owner access.

4. In a second terminal, start a free Cloudflare quick tunnel (no account needed; install
   `cloudflared` from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   It prints a `https://<random>.trycloudflare.com` address — send that to Lody. It changes every
   time you restart the tunnel. (ngrok works the same way but needs a free account.)

What Lody will see: the staging banner, real products and prices from her cards, "Currently
unavailable" on shop pages (no stock counted), and a working Build a Basket in preview mode.
Nothing can be ordered or paid for. Search engines are told not to index staging.

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
