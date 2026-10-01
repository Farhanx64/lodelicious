# Source observations

Verbatim evidence from PRD v2.0 appendices A–C and the owner's basket chart. These files are
**audit inputs, not approved catalog data**. Nothing here is purchasable until a reviewer sets an
approved direct-site price and disposition.

| File | Origin | Rows |
| --- | --- | --- |
| `clover-public-2026-09-22.csv` | Public Clover storefront (Appendix A) | 20 |
| `price-list-screenshot.csv` | Owner-supplied chocolate price screenshot (Appendix B; capture date not recorded) | 19 |
| `doordash-2026-09-25.csv` | DoorDash storefront (Appendix C) | 12 |
| `basket-chart.csv` | Owner's "Lodelicious Gift Basket Details" chart | 9 |
| `clover-export-2026-09-30.csv` | Lody's Clover inventory export `inventory-export-v2.xlsx` (Items sheet; SHA-256 `f52a00d7…0b70d2`) | 105 |

Rules:

- Prices are integer cents exactly as observed. Source names keep their original spelling.
- The 51 observation rows overlap; they are not 51 unique SKUs and not the full Clover catalog.
- DoorDash prices are channel prices. Never copy them to the website or derive a website price by
  removing a presumed markup.
- Titles such as "Nut Free" and "Vegan" are source text, not verified dietary claims.
- The Clover export rows keep Clover's item names and prices verbatim; `notes` holds the Clover ID and
  Clover categories. The export had no SKUs and **no stock quantities** (column empty for every item).
  Lody's rule: the Clover price is correct (`docs/decisions.md` D25).
