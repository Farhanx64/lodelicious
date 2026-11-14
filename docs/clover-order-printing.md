# Printing web orders on your Clover device

When this is on, every paid website order and basket reservation also prints on your Clover device.
You still get the order alert email as before. It is **off** until you and your developer turn it on.

## What prints

A slip titled **WEB SP-1042 PAID** with:

- each item ("2 x Fudge box (Dark)") and its price, plus shipping and sales tax lines, adding up to what the customer paid
- "PAID ONLINE at the website - do not charge again"
- the customer's name and phone
- the pickup time, or the address to ship to
- the customer's note, or for baskets: what goes in it, the card message, and any balance due at pickup

It also shows up in your Clover **Orders** app as an open order with that title. **The customer has
already paid. Don't take payment on it.** The money is on the separate web payment, the same as today.
Once the order is packed you can close or delete the slip order. Nothing is added to your Clover items
or stock.

## Step 1 (you): make a Clover token that can create and print orders

The token you gave us earlier can only read your items, so it can't print. Make a new one:

1. Sign in at clover.com and open your merchant dashboard.
2. Go to **Account & Setup → API Tokens** (under "Business Operations").
3. Click **Create new token** and name it "Website order printing".
4. Tick **Orders: Read** and **Orders: Write**. Nothing else is needed.
5. Save it, then send the token to your developer privately, not by email or text message.

## Step 2 (developer): turn it on

Set these as secrets on the live site:

```
CLOVER_ORDER_PRINT=on
CLOVER_ORDER_PRINT_TOKEN=<the new token>
CLOVER_MERCHANT_ID=<your merchant id>
CLOVER_ORDER_PRINT_ENVIRONMENT=production
```

To turn it off again, remove `CLOVER_ORDER_PRINT` or set it to `off`. Orders and payments keep working
either way.

## Step 3: test it

1. Check that your Clover device is on, signed in and online.
2. Place one small real pickup order on the website and pay with your own card.
3. A slip should print within a minute or two. Check that the items, total, your name and the pickup time are correct.
4. Open **Orders** on the device. The order "WEB SP-…. PAID" should be there.
5. Refund the test payment the usual way (Clover dashboard → Transactions), then delete the slip order.

If nothing prints after a few minutes, look at the device first (paper, power, connection), then ask your
developer to check the site's log for a line starting with `[clover-print]`. A failed print never affects
the customer's order. The site tries again every 10 minutes for up to six tries, and the email alert has
already gone out. Orders older than two days never print, so turning this on won't print your old orders.
