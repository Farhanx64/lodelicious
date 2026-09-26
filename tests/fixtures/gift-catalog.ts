/**
 * FIXTURE catalog for gift-rule tests. Names and prices come from data/source (price-list
 * screenshot and Clover rows); stock quantities, approvals, gift types and premium flags are
 * invented test values, not real store data.
 */
import type { BuilderProduct, GiftType } from "@/src/lib/gifts";

const ALL: GiftType[] = ["sweet", "savory", "sweet_savory", "sympathy"];
const SWEET: GiftType[] = ["sweet", "sweet_savory", "sympathy"];
const SAVORY: GiftType[] = ["savory", "sweet_savory", "sympathy"];

function product(id: string, name: string, priceCents: number, extra: Partial<BuilderProduct> = {}): BuilderProduct {
  return {
    id,
    name,
    priceCents,
    priceApproved: true,
    stock: { state: "known", quantity: 10 },
    premium: false,
    giftTypes: SWEET,
    basketEligible: true,
    category: "chocolate",
    channel: "online",
    exclusiveTo: null,
    maxPerGift: 1,
    fitUnits: 1,
    ...extra,
  };
}

export const PREMIUM = [
  product("P01", "Phillips Chocolate S'mores Bar", 425, { premium: true }),
  product("P02", "Phillips Chocolate Milk Chocolate Bar", 425, { premium: true }),
  product("P03", "Phillips Chocolate Dark Chocolate Bar", 425, { premium: true }),
  product("P06", "Phillips Chocolate Turtle Fudge", 1245, { premium: true }),
  product("P14", "Phillips Chocolate Tulips", 695, { premium: true }),
];

export const SWEETS = [
  product("P05", "Dark Chocolate Covered Almonds", 1295),
  product("P08", "Milk Chocolate Covered Raisins", 1295),
  product("P11", "Vegan Bark", 1795),
  product("P12", "Peanut Butter Bark", 875),
  product("P18", "Chocolate Pretzels 2pc", 475, { category: "snack", giftTypes: ALL }),
  product("P19", "Chocolate Covered Gummy Bears", 1295, { category: "candy" }),
  // Assortment: sold in multiples, so it may appear twice in one gift (PRD GFT 04 exception).
  product("P04", "Phillips Chocolate Princess Assortment", 3495, { premium: true, maxPerGift: 2 }),
  ...Array.from({ length: 16 }, (_, i) =>
    product(`FX-SWEET-${i + 1}`, `Fixture candy ${i + 1}`, 300 + i * 10, { category: "candy" }),
  ),
];

export const SAVORIES = Array.from({ length: 22 }, (_, i) =>
  product(`FX-SAVORY-${i + 1}`, `Fixture savory ${i + 1}`, 400 + i * 10, { category: "savory", giftTypes: SAVORY }),
);

export const SPECIAL_CASES = {
  teddy: product("C20", "Teddy Bear", 1095, { category: "gift", giftTypes: ALL }),
  lebanese: product("FX-LEB", "Lebanese chocolate assortment", 1500, { channel: "in_store_only" }),
  gelato: product("FX-GELATO", "Gelato pint", 900, { channel: "hidden" }),
  giftBox: product("FX-BOX", "Seasonal gift box", 4500, { channel: "inquiry_only" }),
  blanket: product("FX-BLANKET", "Baby blanket", 2500, { category: "baby", exclusiveTo: "baby_white", giftTypes: [] }),
  fruit: product("FX-FRUIT", "Fresh fruit", 800, { category: "fruit", giftTypes: ["sympathy"] }),
  unapproved: product("P13", "Phillips Chocolate Bar", 425, { priceApproved: false, premium: true }),
  unknownStock: product("FX-UNKNOWN", "Chocolate truffles", 1200, { stock: { state: "unknown" } }),
  staleStock: product("FX-STALE", "Sea salt caramels", 2095, { stock: { state: "stale" } }),
  soldOut: product("FX-SOLDOUT", "Chocolate covered cherries", 3295, { stock: { state: "known", quantity: 0 } }),
  lastOne: product("FX-LASTONE", "Turtles box", 2795, { stock: { state: "known", quantity: 1 }, maxPerGift: 3 }),
  card: product("C03", "Cards", 295, { category: "card", basketEligible: false }),
};

export const CATALOG: BuilderProduct[] = [...PREMIUM, ...SWEETS, ...SAVORIES, ...Object.values(SPECIAL_CASES)];

/** First `n` non-premium, always-eligible products for the gift type (cheapest fixture items). */
export function plainItems(n: number, giftType: GiftType = "sweet"): string[] {
  const pool = [...SWEETS, ...SAVORIES].filter((p) => !p.premium && p.maxPerGift === 1 && p.giftTypes.includes(giftType));
  if (pool.length < n) throw new Error(`fixture has only ${pool.length} plain ${giftType} items`);
  return pool.slice(0, n).map((p) => p.id);
}

export const sel = (...ids: string[]) => ids.map((productId) => ({ productId, quantity: 1 }));
