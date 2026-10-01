# Clover inventory sync — status and what we need from Lody

## Status (2026-09-30)

**Not started**: the sync is milestone 5. These pieces are already in place:

- **Merchant ID received.** The account is SOUSET-PINK. The ID is kept in the server's
  `CLOVER_MERCHANT_ID` setting, not in the code.
- **Inventory export received** (105 items) and recorded as source evidence. Website products now
  carry their Clover item ID, and products are matched by ID, never by name. See
  `docs/reconciliation.md`.
- **Price authority decided:** the Clover price wins (D25).
- **In-store reserve:** each product has a "Keep for in-store" number, 1 by default (D26).
- **Stock modelling:** stock is tracked per product and per option, for example pink and blue.
  Unknown stock can't be bought.
- **Resumable syncs:** `sync-jobs` stores a lock and a checkpoint, so a sync the host kills resumes
  where it stopped.
- **Audit log:** every stock change is written to it.

Planned design (decision D10, which replaces SKU IQ):
- Use Clover's REST API with an **inventory-only** token Lody creates.
- A scheduled cPanel job reads Clover stock every few minutes.
- A queue sends each website sale back to Clover exactly once.
- Basket sales deduct the individual chocolates and candies, never a "basket" item.
- In-store sales reach the website on the next scheduled check. The in-store reserve covers that gap.

## Still needed from Lody

1. **Stock counts in Clover.** The export's Quantity column is empty for all 105 items. Turn on
   "track stock" for the items sold online and enter the counts. Clover's counts become the
   website's starting stock, and nothing can be bought online until they exist.
2. **Split shared items in Clover** so stock can be tracked separately:
   - "Philips Chocolate Bar" is sold on the site as two products, Dark and Milk.
   - "Princess Assortment" comes in two styles, Window and Classic.
3. **Add the missing items to Clover:**
   - baby ceramic bowl, shoes and block, in pink and blue
   - the white wicker bassinet
   - the Cape Cod fudges (is "sea salt caramel fudge" one of them?)
4. **Teddy Bear.** The card says $14.95. Clover has "Teddy Bear" at $10.95 and "Teddy Bear Vintage
   Collection" at $14.95. Which one is on the card?
5. **The API token, when the sync is built.** Create it in the Clover dashboard with **Inventory:
   read and write only**: no payments, no customers, no merchant details. Share it privately. It
   never goes in email text or the code repository. Lody can delete it at any time to switch the
   access off.
6. **Decisions still open:**
   - How often to check Clover, for example every 5 or 15 minutes.
   - Whether packaging (baskets, ribbon) is tracked in Clover.
   - The per-product reserve numbers, if not 1.
7. **The DoorDash page link** for local delivery (D28).
8. **Later, for payments (milestone 6):**
   - Clover ecommerce API keys (public and private).
   - Lody's approval of Clover's online processing fees before anything goes live.
   - Money goes straight to her Clover account, and the website never sees or stores card numbers.

Clover's API itself has no extra charge. Card processing fees apply only once payments are turned on.
