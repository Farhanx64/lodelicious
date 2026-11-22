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
  /** Whole shop categories whose products belong here too (e.g. baby-gifts for a new baby). */
  categorySlugs?: readonly string[];
  /** Extra internal links shown under the intro, e.g. the Baby Gifts page. */
  related?: readonly { href: string; label: string }[];
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
  {
    slug: "mothers-day",
    name: "Mother's Day",
    title: "Mother's Day Gift Baskets in Plymouth, MA | Chocolates & Treats",
    description: "Mother's Day gift baskets and chocolate gifts from a family-owned shop in Plymouth, MA. Phillips chocolates, sea salt caramels and treats. Pickup, delivery or shipping.",
    h1: "Mother's Day Gift Baskets",
    intro:
      "For mom, grandma or anyone who has looked after you: a basket of chocolates and treats, put together by hand in our Plymouth shop. Choose one of our baskets, or build one around what she loves.",
    basketSlugs: ["small-gift-basket", "medium-gift-basket", "large-gift-basket"],
    match: /assortment|caramel|princess|rose|truffle/i,
    sections: [
      { heading: "Mother's Day gifts from the South Shore", body: PICKUP_DELIVERY },
      { heading: "Plan ahead", body: "Custom baskets need notice before pickup, so order early, and call us if you need it on a particular day." },
    ],
    faqs: [
      { q: "Can I send a Mother's Day basket to another state?", a: "Yes. We ship anywhere in the US, and shipping is priced at checkout from the ZIP code." },
      { q: "Can I add a card?", a: "Yes. Add a gift message when you build a basket, or tell us the message when you order. Greeting cards are in the shop too." },
      { q: "Can I choose what goes in the basket?", a: "Yes. Build a basket online: pick a size, set a budget if you like, and choose each item." },
    ],
  },
  {
    slug: "valentines-day",
    name: "Valentine's Day",
    title: "Valentine's Day Chocolates & Gift Baskets in Plymouth, MA",
    description: "Valentine's Day chocolates and gift baskets from Plymouth, MA: Phillips assortment boxes, chocolate roses, caramels and sweets. Pickup, local delivery or US shipping.",
    h1: "Valentine's Day Chocolates & Gifts",
    intro:
      "Chocolates are the classic Valentine's gift, and we keep plenty of them: Phillips assortment boxes, sea salt caramels and other sweets, alone or in a basket put together by hand in our Plymouth shop.",
    basketSlugs: ["small-gift-basket", "medium-gift-basket"],
    match: /assortment|caramel|princess|rose|truffle|cherr/i,
    sections: [
      { heading: "Valentine's gifts on the South Shore", body: PICKUP_DELIVERY },
      { heading: "A basket for two", body: "Want something bigger than a box of chocolates? Build a basket with their favourite sweets and add a teddy bear or a card." },
    ],
    faqs: [
      { q: "When should I order for Valentine's Day?", a: "As early as you can, especially for a custom basket or shipping. Call us if you need it on a particular day." },
      { q: "Do you ship Valentine's chocolates?", a: "Yes, anywhere in the US. Shipping is priced at checkout from the ZIP code." },
    ],
  },
  {
    slug: "new-baby",
    name: "New Baby",
    title: "New Baby Gift Baskets in Plymouth, MA | Baby Keepsakes & Sweets",
    description: "New baby and baby shower gift baskets from Plymouth, MA: keepsake ceramics in pink or blue, teddy bears, books and sweets for the new parents.",
    h1: "New Baby Gift Baskets",
    intro:
      "Welcome a new arrival with keepsake ceramics in pink or blue, a teddy bear or a children's book, and sweets for the tired new parents. Put together by hand in our Plymouth shop.",
    basketSlugs: [],
    match: /baby|teddy|seuss/i,
    categorySlugs: ["baby-gifts"],
    related: [{ href: "/baby-gifts", label: "See all baby gifts" }],
    sections: [
      { heading: "For baby showers and new parents", body: `A gift for the shower, the hospital homecoming or the first visit. ${PICKUP_DELIVERY}` },
      { heading: "Build a baby basket", body: "Choose the keepsakes and treats yourself when you build a basket online, or call us and we'll help you choose." },
    ],
    faqs: [
      { q: "Do the baby ceramics come in pink and blue?", a: "The ceramic bowl, shoes and BABY block each come in pink or blue. Choose the colour on the product page." },
      { q: "Can you deliver a baby gift in Plymouth?", a: `Yes. ${PICKUP_DELIVERY}` },
    ],
  },
  {
    slug: "get-well",
    name: "Get Well",
    title: "Get Well Soon Gift Baskets in Plymouth, MA | Treats & Comfort",
    description: "Get well soon gift baskets from a family-owned Plymouth, MA shop: chocolates, snacks and comforting treats for someone recovering. Pickup, delivery or shipping.",
    h1: "Get Well Soon Gift Baskets",
    intro:
      "A basket of favourite snacks and treats is a kind way to say \"thinking of you\" while someone recovers. We put each one together by hand in our Plymouth shop.",
    basketSlugs: ["small-gift-basket", "medium-gift-basket", "large-savory-basket"],
    match: /teddy|card|sugar-free/i,
    sections: [
      { heading: "Sending to a home or a hospital", body: `${PICKUP_DELIVERY} Hospitals have their own rules about deliveries and food, so check with them first; call us and we'll work out the best way.` },
      { heading: "Sweet, savory or sugar-free", body: "Not everyone wants chocolate when they're unwell. We also have savory baskets and sugar-free sweets; tell us about dietary needs when you order." },
    ],
    faqs: [
      { q: "Do you have sugar-free options?", a: "Yes, we carry sugar-free candy and chocolates. Ask us what's in stock, and tell us about any dietary needs when you order." },
      { q: "Can I add a card message?", a: "Yes. Add a gift message when you build a basket, or tell us the message when you order." },
    ],
  },
  {
    slug: "anniversary",
    name: "Anniversary",
    title: "Anniversary Gift Baskets in Plymouth, MA | Chocolates & Sweets",
    description: "Anniversary gift baskets and chocolates from Plymouth, MA: Phillips assortment boxes, sea salt caramels and treats for a couple or a work anniversary.",
    h1: "Anniversary Gift Baskets",
    intro:
      "For a wedding anniversary, your parents' big year or a colleague's work milestone: chocolates and treats in a basket put together by hand in our Plymouth shop.",
    basketSlugs: ["medium-gift-basket", "large-gift-basket", "extra-large-gift-basket"],
    match: /assortment|caramel|princess|rose/i,
    sections: [
      { heading: "Anniversary gifts on the South Shore", body: PICKUP_DELIVERY },
      { heading: "Work anniversaries", body: "Celebrating a team member's milestone? See our corporate gifts page for several baskets at once." },
    ],
    faqs: [
      { q: "Can you make an anniversary basket for a couple?", a: "Yes. Build a basket online with sweets for two, or tell us what they like and we'll put one together." },
      { q: "Can you ship an anniversary basket?", a: "Yes, anywhere in the US. Shipping is priced at checkout from the ZIP code." },
    ],
  },
];

export const occasionBySlug = (slug: string) => OCCASIONS.find((o) => o.slug === slug) ?? null;
