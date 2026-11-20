/**
 * Occasion landing pages (D68): /gift-baskets/<occasion>. Each names the occasion and the town in
 * its title and H1, lists the matching baskets and products, answers common questions (FAQPage
 * schema) and links to delivery, pickup and Build a Basket. Wording is ours; product lists come
 * from the live catalog, so nothing here promises an item we don't stock.
 */

export type Occasion = {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Gift-basket slugs shown first (from the /gift-baskets groups). */
  basketSlugs: readonly string[];
  /** Other products whose title, brand or description match (case-insensitive). */
  match: RegExp | null;
  sections: readonly { heading: string; body: string }[];
  faqs: readonly { q: string; a: string }[];
};

const PICKUP_DELIVERY =
  "Pick up at our shop in Manomet, Plymouth, order local delivery through DoorDash, or have it shipped anywhere in the US (shipping is priced at checkout from the ZIP code).";

export const OCCASIONS: readonly Occasion[] = [
  {
    slug: "sympathy",
    name: "Sympathy",
    title: "Sympathy Gift Baskets in Plymouth, MA | Delivery & Pickup",
    description: "Sympathy and condolence gift baskets made by hand in Plymouth, MA: Phillips chocolates, fruit, crackers and comforting treats. Pickup, local delivery or US shipping.",
    h1: "Sympathy Gift Baskets",
    intro:
      "When words are hard to find, a basket of comforting treats says you're thinking of them. Our sympathy baskets are put together by hand in our Plymouth shop with premium chocolates such as Phillips, savory crackers and gentle sweets.",
    basketSlugs: ["small-sympathy-basket", "medium-sympathy-basket", "large-sympathy-basket"],
    match: /sympathy|condolence/i,
    sections: [
      { heading: "Condolence baskets for Plymouth and the South Shore", body: `For families in Plymouth, Kingston, Duxbury, Carver and nearby towns. ${PICKUP_DELIVERY}` },
      { heading: "What's in our sympathy baskets", body: "Typically premium chocolates, fresh fruit, savory crackers and a variety of treats. Contents change with what's in stock; call us and we'll tell you what's in them today." },
    ],
    faqs: [
      { q: "Can you deliver a sympathy basket to a home or funeral home in Plymouth?", a: `Yes. ${PICKUP_DELIVERY} Call the shop if you need it on a specific day.` },
      { q: "Can I add a card message?", a: "Yes. Add a gift message when you build a basket, or tell us the message when you order." },
      { q: "Can you make a basket without nuts or for a dietary need?", a: "Tell us about allergies or dietary needs when you order. We do our best with what's in stock and will contact you before making a significant change." },
    ],
  },
  {
    slug: "birthday",
    name: "Birthday",
    title: "Birthday Gift Baskets in Plymouth, MA | Chocolates & Treats",
    description: "Birthday gift baskets from Plymouth, MA: sweet and savory treats, chocolates, a birthday card and festive letters. Pickup, local delivery or US shipping.",
    h1: "Birthday Gift Baskets",
    intro: "Birthday baskets packed with sweet and savory treats, gourmet snacks and chocolates, finished with a birthday card and festive letters. Made by hand in Plymouth.",
    basketSlugs: ["large-birthday-basket", "medium-gift-basket", "large-gift-basket"],
    match: /birthday/i,
    sections: [
      { heading: "Birthday baskets delivered on the South Shore", body: PICKUP_DELIVERY },
      { heading: "Make it your own", body: "Want to choose every item? Build a basket online: pick a size, set a budget and fill it with their favourites." },
    ],
    faqs: [
      { q: "How soon can I get a birthday basket?", a: "Call the shop to check what is ready today. Custom baskets need notice before pickup." },
      { q: "Do you ship birthday baskets?", a: "Yes, anywhere in the US. Shipping is priced at checkout from the ZIP code." },
    ],
  },
  {
    slug: "thank-you",
    name: "Thank You",
    title: "Thank You Gift Baskets in Plymouth, MA | Chocolates & Sweets",
    description: "Thank-you gift baskets and chocolate gifts from a family-owned Plymouth, MA shop. For hosts, teachers, clients and neighbours. Pickup, delivery or shipping.",
    h1: "Thank You Gift Baskets",
    intro: "Say thanks with chocolates, fudge and treats picked by hand: for a host, a teacher, a neighbour or a client.",
    basketSlugs: ["small-gift-basket", "medium-gift-basket", "large-gift-basket", "extra-large-gift-basket"],
    match: /assortment|box|turtle/i,
    sections: [{ heading: "Pickup, delivery or shipping", body: PICKUP_DELIVERY }],
    faqs: [{ q: "Can I order several thank-you baskets at once?", a: "Yes. For several baskets or a business order, see our corporate gifts page or send us a message." }],
  },
  {
    slug: "cape-cod",
    name: "Cape Cod",
    title: "Cape Cod Gift Baskets | Fudge, Bog Frogs & Local Treats",
    description: "Cape Cod and Plymouth gift baskets with Cape Cod fudge, Cranberry Bog Frogs and New England sweets, shipped anywhere in the US from Manomet, MA.",
    h1: "Cape Cod Gift Baskets",
    intro: "A taste of the Cape and the South Shore: Cape Cod fudge, Cranberry Bog Frogs and New England sweets, put together in our shop by the Plymouth–Cape Cod line.",
    basketSlugs: [],
    match: /cape cod|cranberry|bog/i,
    sections: [{ heading: "Send a taste of Cape Cod anywhere", body: PICKUP_DELIVERY }],
    faqs: [{ q: "Can you ship Cape Cod treats out of state?", a: "Yes, to anywhere in the US. Shipping is priced at checkout from the ZIP code." }],
  },
  {
    slug: "christmas",
    name: "Christmas",
    title: "Christmas Gift Baskets in Plymouth, MA | Chocolates & Fudge",
    description: "Christmas and holiday gift baskets from Plymouth, MA: Phillips chocolates, fudge and sweets. Order early for pickup, local delivery or US shipping.",
    h1: "Christmas & Holiday Gift Baskets",
    intro: "Holiday baskets with chocolates, fudge and festive treats, made by hand in Plymouth. Order early in December: custom baskets need notice.",
    basketSlugs: ["small-gift-basket", "medium-gift-basket", "large-gift-basket", "extra-large-gift-basket"],
    match: /christmas|holiday|assortment|fudge/i,
    sections: [
      { heading: "Holiday baskets for family, clients and neighbours", body: PICKUP_DELIVERY },
      { heading: "Ordering for a business?", body: "We make holiday baskets for teams and clients. See our corporate gifts page." },
    ],
    faqs: [{ q: "When should I order Christmas baskets?", a: "As early as you can in December, especially for several baskets or shipping. Custom baskets need notice before pickup." }],
  },
];

export const occasionBySlug = (slug: string) => OCCASIONS.find((o) => o.slug === slug) ?? null;
