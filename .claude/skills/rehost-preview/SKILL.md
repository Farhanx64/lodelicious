---
name: rehost-preview
description: Rebuild and re-serve the Lodelicious staging preview on this Mac after a merge to main, then check the public tunnel link. Use when asked to rebuild, rehost, refresh or update the preview, or after merging a PR. Also covers what to do when the tunnel link is dead.
---

# Rehost the preview

The preview serves the last production BUILD, not the files in the folder. After every merge to `main`, rebuild and restart it. The public link is a Cloudflare quick tunnel that Lody already has.

## Never

- Stop or restart `cloudflared`: its link changes and Lody loses it.
- Touch `.data/` (database, logs) or `.env` (changing `PAYLOAD_SECRET` breaks owner login). Don't reseed.
- Stop `next dev -p 3100`: its output is in `.next/dev`, separate from the production build.

## Steps

Run from the repo root.

1. Update to main: `git fetch origin && git merge --ff-only origin/main`
2. Migrate: `npm run migrate`
3. Stop the server: `pkill -f "node server.js"`
4. Build (about 1 to 2 minutes; the link is down meanwhile): `npm run build`
5. Start it detached:
   `NODE_ENV=production PORT=3000 NODE_OPTIONS=--max-old-space-size=768 nohup npm run serve > .data/preview.log 2>&1 < /dev/null & disown`
6. Wait about 20 seconds, then check the link returns 200 for `/`, `/shop`, `/rewards`, `/admin`:
   `T=$(grep -o 'https://[a-z-]*\.trycloudflare\.com' .data/tunnel.log | head -1)`
   `for p in / /shop /rewards /admin; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' -L $T$p)"; done`
   Check `localhost:3000`, not `127.0.0.1` (the server may listen on IPv6 only).
7. Report the link and the four codes.

If the build fails, the old server is already stopped: fix the error, rebuild, and start again from step 5.

## If the tunnel is dead (the link returns an error and `ps aux | grep cloudflared` shows nothing)

Only now retunnel, and tell the user the link will change and must be re-sent to Lody:
`nohup cloudflared tunnel --no-autoupdate --url http://localhost:3000 > .data/tunnel.log 2>&1 < /dev/null & disown`
Then read the new link from `.data/tunnel.log`.

## Repo gotchas

- Default branch on GitHub is `claude/sweet-meitner-2hnl84`, but the real line is `main`. Always `gh pr create --base main`.
- Push with `git -c credential.helper='!gh auth git-credential' push`.
- Next free decision number: check the end of `docs/decisions.md` (D48 was the last when this was written).
