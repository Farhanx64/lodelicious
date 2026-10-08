# Price & identity reconciliation (2026-09-26)

Owner product cards (source `K`, Lody's own marketing cards, 2026-09-26) are the newest and most
direct price source, so the seeded catalog uses them. Every difference from older sources is listed
here for Lody to confirm. All values in USD.

| Product | Card (K) | Price-list screenshot (P) | Clover public (C) | DoorDash (D) | Seeded |
| --- | --- | --- | --- | --- | --- |
| Phillips Dark Chocolate Bar | 4.25 (K01) | 5.95 (P03) / 4.25 (P13) | — | 5.95 (D09) | **4.25** — settles P03 vs P13: $5.95 is the DoorDash price |
| Phillips Milk Chocolate Bar | 4.25 (K02) | 5.95 (P02) / 4.25 (P13) | — | 5.95 (D08) | **4.25** |
| Phillips S'mores Bar | 4.25 (K03) | 5.95 (P01) / 4.25 (P15) | — | 5.95 (D07) | **4.25** |
| Phillips Princess Assortment Box | 30.95 (K04) | 34.95 (P04) | — | — | **30.95** ⚠ differs from screenshot |
| Milk Chocolate Covered Raisins, 7 oz | 9.95 (K05) | 12.95 (P08) | — | 12.95 (D12) | **9.95** ⚠ |
| Chocolate Covered Gummy Bears | 9.95 (K06) | 12.95 (P19) | — | 12.95 (D10) | **9.95** ⚠ |
| Phillips Turtle Fudge | 12.45 (K07) | 12.45 (P06) | — | — | 12.45 |
| Turtles 9pc Assortment Box | 27.95 (K08) | 27.95 (P10); P09 "Turtles Bars" 10.95 | — | — | 27.95 (P09 still unresolved) |
| Peanut Butter Bark (2 pc) | 8.75 (K09) | 8.75 (P12) | — | — | 8.75 |
| Sea Salt Chocolate Caramels (9 pc) | 20.95 (K10) | 20.95 (P07) | — | — | 20.95 |
| Swedish Candy Bag, 8 oz | 14.95 (K11) | — | — | 17.95 (D06) | **14.95** |
| 10 Pieces Mini Pancakes | 10.00 (K12) | — | 10.00 (C01) | 12.95 (D03) | 10.00 |
| Teddy Bear | 14.95 (K13) | — | 10.95 (C20) | — | **14.95** ⚠ differs from Clover |
| Dr. Seuss Book | 7.95 (K14) | — | 6.25 (C04) | — | **7.95** ⚠ differs from Clover |
| Greeting Cards | 3.95 (K15) | — | 2.95 (C03) | — | **3.95** ⚠ differs from Clover |
| Baby ceramic bowl / block | — | — | — | — | 14.95, **unapproved** (project-lead assumption; brief priced "small 5×5×4") |
| Baby ceramic shoes | — | — | — | — | 19.95, **unapproved** (project-lead assumption; brief priced "large 8×4×4") |

Still unresolved (not seeded as products): P05 Dark Chocolate Covered Almonds, P09 Turtles Bars,
P11 Vegan Bark, P14 Chocolate Tulips, P16 Chocolate Covered Cherries, P17 Chocolate Pretzels
(multi-piece), P18 Chocolate Pretzels 2pc, C02/C06/C16 pancake flavors, C05 Dubai Chocolate,
C11/C18 Strawberry Dubai Cups, D05 Macarons — no card, photo or current price was supplied. They
remain in **Source records** (unreviewed) for Lody to disposition. The curated baskets are the
exception: see "Curated gift baskets" below.

⚠ = Clover or the screenshot shows a different price: if the in-store Clover price is still
correct, the website will disagree with the register until one of them is updated.

# Clover inventory export (2026-09-30)

Lody's export `inventory-export-v2.xlsx` (SHA-256 `f52a00d7e405824db8f6cda9f827a9cbba1f4f38742ce093f7a53cdbfa0b70d2`)
is recorded row-for-row as `data/source/clover-export-2026-09-30.csv` (refs X001–X105). Lody's rule
(D25): **the Clover price is correct**.

What the export does **not** contain:

- **Stock counts: the Quantity column is empty for all 105 items.** Stock tracking is off or no
  counts have been entered, so nothing can become purchasable from this file.
- SKUs (none) and product codes (one item, Teddy Bear "013"). Products match Clover by Clover ID.

## Website products → Clover

| Website product | Clover item (ref) | Clover | Website now | Note |
| --- | --- | --- | --- | --- |
| Phillips Dark Chocolate Bar | Philips Chocolate Bar (X015) | 4.25 | 4.25 | ⚠ shares one Clover item with the Milk bar |
| Phillips Milk Chocolate Bar | Philips Chocolate Bar (X015) | 4.25 | 4.25 | ⚠ same; split in Clover to track stock separately |
| Phillips S'mores Bar | S'mores Bar (X024) | 4.25 | 4.25 | |
| Phillips Princess Assortment Box | Princess Assortment (X014) | 30.95 | 30.95 | ⚠ window and classic styles share one Clover item |
| Milk Chocolate Covered Raisins | Milk Chocolate Raisins (X046) | 9.95 | 9.95 | |
| Chocolate Covered Gummy Bears | chocolate covered gummy bears (X073) | 9.95 | 9.95 | |
| Phillips Turtle Fudge | Turtles Fudge (X008) | 12.45 | 12.45 | |
| Turtles 9pc Assortment Box | Turtles Box (X012) | 27.95 | 27.95 | |
| Peanut Butter Bark | Peanut Butter Bark (X053) | 8.75 | 8.75 | |
| Sea Salt Chocolate Caramels (9 pc) | Sea Salt Caramels (X001) | 20.95 | 20.95 | |
| Swedish Candy Bag | Swedish Candy (X011) | 14.95 | 14.95 | |
| 10 Pieces Mini Pancakes | 10 Piece Pancakes (X069) | 10.00 | 10.00 | |
| Dr. Seuss Book | Dr Suess Books (X035) | 6.25 | **6.25** | was 7.95 (card) |
| Greeting Cards | Cards (X063) | 2.95 | **2.95** | was 3.95 (card) |
| Teddy Bear | Teddy Bear (X039) 10.95 **or** Teddy Bear Vintage Collection (X040) 14.95 | ? | 14.95 | ⚠ not linked: which one is on the card? |
| Baby ceramic bowl / shoes / block | — | — | 14.95 / 19.95 / 14.95 | ⚠ not in Clover; add to sync stock |
| Cape Cod fudges (4, drafts) | — (maybe "sea salt caramel fudge" X074?) | — | unpriced | ⚠ not in Clover by name |
| White wicker bassinet (Baby White) | — | — | in presentation price | ⚠ not in Clover |

## Added from the export (D29): 49 products, Clover price, no photo, not in custom gifts yet

- **Phillips (chocolate):**
  - Turtles Bars 10.95 (X013, P09)
  - Hash Bar 12.95 (X016)
  - Chocolate Pretzels (2 pc) 4.75 (X054, P18)
  - Chocolate Pretzels 7.95 (X076, P17)
  - Sugar-Free Theatre Box 16.95 (X057)
  - Vegan Bark 17.95 (X064, P11)
  - Chocolate Covered Cherries 32.95 (X096, P16)
- **Chocolate:**
  - Dark Chocolate Sea Salt 24.95 (X059; Clover name "(Nut Free)", not repeated as a claim)
  - Chocolate Covered Almonds 9.95 (X045)
  - Dark Chocolate Covered Almonds 9.99 (X103, P05, D11)
  - Chocolate Covered Cashews 12.95 (X101)
  - Chocolate Covered Blueberries 11.95 (X102)
  - Dark Chocolate Covered Coffee Beans 12.95 (X104)
  - Chocolate Almond Clusters 2.50 (X075)
  - Dark Chocolate Sea Salt Caramel 9.99 (X098)
  - Milk Chocolate Sea Salt Caramel 9.99 (X099)
  - Molasses Chips 7.45 (X105)
  - Chocolate Rose 4.99 (X079)
  - Mini Dubai Chocolate Bar 5.95 (X086)
  - Swiss Chocolate Bar 7.95 (X080)
  - Toblerone 3.69 (X097)
  - Cranberry Chocolate Bar 5.50 (X052)
- **Fudge:** Sea Salt Caramel Fudge 10.95 (X074)
- **Candy:**
  - Cranberry Bog Frogs 19.95 (X051)
  - Salt Water Taffy 7.50 (X050)
  - Sugar-Free Salt Water Taffy 8.25 (X081)
  - Sugar-Free Mix 10.95 (X084)
  - Small Sugar-Free Bag 5.45 (X085)
  - Jordan Almonds — Small / Medium / Large 6.95 / 12.95 / 19.95 (X047–X049)
  - Peelerz 4.45 (X056)
  - Swedish Fish 3.75 (X031)
  - Gummy Bears 3.75 (X032)
  - Black Licorice 8.95 (X100)
  - Sour Flush Candy 4.75 (X078)
  - Flush Candy 3.50 (X082)
  - Charleston Chew 3.85 (X036)
  - Skybar 3.25 (X037)
  - Golden Coin 1.00 (X010)
  - Tic Tac 1.99 (X029)
  - Lollipops 4.25 (X038)
  - Mini Pop 1.00 (X055)
  - Flower Pop 3.25 (X087)
- **Fresh treats (perishable):** Baklava 3.95 (X009), Biscoff Cookie 1.99 (X068)
- **Gift add-ons:** Pug Teddy 16.95 (X065), Blessed Teddy Bear 18.95 (X066), Little Brown Teddy 10.95 (X067)

## Left out (still in Source records, for Lody)

- **Coffee and drinks:**
  - X017–X020, X022, X023, X077 (coffee)
  - X041–X044 (drinks)
- **Prepared and frozen:**
  - Affogato X021
  - Dubai cups X025, X026
  - Gelato X027, X028 (PRD: gelato hidden)
  - Ice-cream-truck items X088–X095
  - Pancake flavours X070–X072 (could become options of the mini pancakes)
- **Savory (Lody will name them later):** Focaccia Crisps X030, Smoked Almonds X033, Summer Sausage X058
- **OMNIYA, until the Lebanese in-store-only question is settled:** X002–X007, X034, X060–X062, X083
- **Already on the site:** Teddy Bear X039 / Teddy Bear Vintage Collection X040, pending the teddy question above

# Curated gift baskets (2026-10-06, D38)

Nine curated baskets are seeded as products in the **Gift baskets** category. Price: the public
Clover storefront observation of 2026-09-22 (the C rows below). Contents, item counts and basket
sizes: the owner's basket chart. The price is **not approved** (Lody's Clover export, D25, has no
baskets), the channel is inquiry-only, and stock is unknown.

| Website product | Clover public (ref) | Chart row | Seeded price | Status |
| --- | --- | --- | --- | --- |
| Small Gift Basket | Small Gift Basket 79.95 (C17) | small, 6–8 items, 12 in | 79.95 | unapproved, inquiry-only |
| Medium Gift Basket | Medium Gift Basket 98.95 (C13) | medium, 10–12 items, 14 in | 98.95 | unapproved, inquiry-only |
| Large Gift Basket | Large Gift Basket 139.95 (C09) | large, 12–14 items, 18 in | 139.95 | unapproved, inquiry-only |
| Extra Large Gift Basket | Extra Large gift basket 199.99 (C07) | extra_large, 18–20 items, 18–20 in | 199.99 | unapproved, inquiry-only; builder's Extra Large stays off (D27) |
| Large Birthday Basket | Large Birthday Basket 139.95 (C08) | large_birthday, 12–14 items, 16 in | 139.95 | unapproved, inquiry-only |
| Large Savory Basket | Large Savory Basket 139.95 (C10) | large_savory, 12–14 items, 16 in | 139.95 | unapproved, inquiry-only |
| Small Sympathy Basket | Small sympathy basket 79.95 (C19) | small_sympathy, 6–8 items, 12 in | 79.95 | unapproved, inquiry-only |
| Medium Sympathy Basket | Medium sympathy gift basket 98.95 (C15) | medium_sympathy, 10–12 items, 14 in | 98.95 | unapproved, inquiry-only |
| Large Sympathy Basket | Large Sympathy Gift Basket 139.95 (C12) | large_sympathy, 13–16 items, 16 in | 139.95 | unapproved, inquiry-only |

- **Not seeded:** C14 "Medium Nut Free Basket" (98.95). "Nut Free" is a source title, not a verified
  allergen claim, so there is no product by that name. It stays in Source records, and customers with
  a dietary request use the contact form.
- **Other C rows are not baskets:** C01–C06, C11, C16, C18 (pancakes, cards, books, Dubai items,
  Strawberry Dubai Cups) and C20 (teddy bear) are handled as before.
- **For Lody:** approve or change each price, say what each basket contains and how much stock there is
  (the chart lists typical contents, not an exact list), and send photos.
