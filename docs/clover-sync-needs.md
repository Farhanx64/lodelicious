# Clover inventory sync — status and what we need from Lody

## Status (2026-09-26)

**Not started** — the sync is milestone 5. Groundwork already in place:

- Every product has `sku` and `cloverId` fields and links to its observed source records.
- Stock is modelled per product and per option (e.g. pink/blue); unknown stock can't be bought.
- `sync-jobs` stores a lock and checkpoint so a sync killed by the host resumes where it stopped.
- Every stock change is written to the audit log.

Planned design (decision D10, replaces SKU IQ): Clover's REST API with a merchant API token, a
scheduled cPanel job that reads Clover stock every few minutes, and a queue that sends each website
sale back to Clover exactly once. Basket sales deduct the individual chocolates/candies, never a
"basket" item. Without a registered Clover app we can't receive instant notifications, so in-store
sales reach the website on the next scheduled check — the website keeps a small safety buffer for
that gap.

## What we need from Lody

1. **Clover merchant ID** and whether her account is US (the API address differs by region).
2. **An inventory export**: Clover dashboard → Inventory → Items → Export. It gives us each item's
   Clover ID, SKU/product code, price, category and stock, so products can be matched by ID, not by
   name.
3. **Stock tracking**: confirm "track stock" is on for the items she sells online, and that the
   counts in Clover are right today — Clover's counts become the website's starting stock.
4. **API access**: an API token with **Inventory: read and write** (and **Merchant: read**) — created
   in the Clover dashboard's API token settings, or add the developer as an employee who can create
   one. Share it privately; it never goes in email text or the code repository.
5. **Decisions**
   - Which system wins if prices differ (see `docs/reconciliation.md`): the website's approved
     price, or Clover's?
   - How often to check Clover for in-store sales (e.g. every 5 or 15 minutes), and the safety
     buffer (e.g. stop selling online when 1 is left).
   - Whether packaging (baskets, ribbon) is tracked in Clover.
6. **Later, for payments (milestone 6):** Clover ecommerce API keys (public + private), and her
   approval of Clover's online processing fees before anything goes live.

Clover's API itself has no extra charge; card processing fees apply only once payments are turned on.
