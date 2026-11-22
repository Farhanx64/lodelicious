/**
 * Category landing pages (D69): /shop/category/<slug>. The copy is ours and general: it names the
 * kinds of things in the category, never a price, size, ingredient or allergen. Which products
 * appear comes from the live catalog. Categories with a page of their own (gift baskets, baby
 * gifts) redirect there.
 */

export type CategoryCopy = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Occasion slugs to link to. */
  occasions: readonly string[];
  faqs: readonly { q: string; a: string }[];
};

/** Categories whose landing page already exists elsewhere. */
export const CATEGORY_PAGES_ELSEWHERE: Readonly<Record<string, string>> = {
  "gift-baskets": "/gift-baskets",
  "baby-gifts": "/baby-gifts",
};

const ALLERGEN_FAQ = {
  q: "Where can I find allergen information?",
  a: "Each product page lists the allergen and dietary notes we have for it. If a product has none yet, or you have a serious allergy, please ask us before ordering.",
};

const GETTING_IT = {
  q: "Can I pick up or have it shipped?",
  a: "Order online and pick up at our shop in Manomet, Plymouth, order local delivery through DoorDash, or have it shipped within the US. Each product page says whether that product can ship.",
};

export const CATEGORY_COPY: readonly CategoryCopy[] = [
  {
    slug: "chocolate",
    title: "Chocolates in Plymouth, MA | Phillips Chocolates, Turtles & Bark",
    description: "Phillips Chocolates bars, assortment boxes, turtles and bark, plus chocolate-covered nuts and fruit, from our gift shop in Manomet, Plymouth, MA.",
    h1: "Chocolates",
    intro:
      "Our chocolate shelves are mostly Phillips Chocolates: bars, assortment boxes, turtles, caramels and bark. Alongside them are chocolate-covered nuts, fruit and coffee beans, and a few favourite bars from further away. Buy a single bar, a gift box, or add them to a basket.",
    occasions: ["valentines-day", "mothers-day", "thank-you", "christmas", "anniversary"],
    faqs: [
      { q: "Do you have sugar-free or vegan chocolate?", a: "Look for products such as Phillips' Sugar-Free Theatre Box and Vegan Bark, and check each product's dietary notes before ordering. Ask us what's in stock." },
      { q: "Can I put chocolates in a gift basket?", a: "Yes. Build a basket online and choose the chocolates yourself, or pick one of our ready-made baskets." },
      GETTING_IT,
      ALLERGEN_FAQ,
    ],
  },
  {
    slug: "fudge",
    title: "Fudge in Plymouth, MA | Turtle Fudge & Sea Salt Caramel Fudge",
    description: "Fudge from our Plymouth, MA gift shop: chocolate-covered turtle fudge, sea salt caramel fudge and more. Pick up in Manomet, add it to a gift basket or ship it.",
    h1: "Fudge",
    intro:
      "Rich, creamy fudge, from Phillips' chocolate-covered turtle fudge to sea salt caramel. A classic New England treat to bring home, add to a basket or send to someone far away.",
    occasions: ["cape-cod", "christmas", "thank-you", "birthday"],
    faqs: [{ q: "Can I add fudge to a gift basket?", a: "Yes. Choose it when you build a basket online, or ask us to add it to one of ours." }, GETTING_IT, ALLERGEN_FAQ],
  },
  {
    slug: "candy",
    title: "Candy Shop in Plymouth, MA | Swedish Candy, Taffy & Bog Frogs",
    description: "Swedish candy, salt water taffy, Cranberry Bog Frogs, Jordan almonds, licorice and nostalgic candy bars from our candy shop in Manomet, Plymouth, MA.",
    h1: "Candy",
    intro:
      "A proper candy counter: Swedish candy, salt water taffy, Cranberry Bog Frogs, Jordan almonds, licorice, lollipops and old-fashioned candy bars, with sugar-free choices too.",
    occasions: ["birthday", "cape-cod", "get-well", "thank-you"],
    faqs: [
      { q: "Do you have sugar-free candy?", a: "Yes, including sugar-free salt water taffy and a sugar-free mix. Check each product's notes and ask us what's in stock." },
      GETTING_IT,
      ALLERGEN_FAQ,
    ],
  },
  {
    slug: "fresh-treats",
    title: "Fresh Treats in Plymouth, MA | Baklava, Cookies & Mini Pancakes",
    description: "Freshly made treats from our Manomet, Plymouth, MA shop: baklava, cookies, mini pancakes and more, ready for pickup.",
    h1: "Fresh Treats",
    intro: "Freshly made treats for pickup at our shop in Manomet: baklava, cookies, mini pancakes and other fresh treats.",
    occasions: ["birthday", "thank-you"],
    faqs: [
      { q: "Can fresh treats be shipped?", a: "Fresh treats are made for pickup. Each product page says whether it can ship." },
      ALLERGEN_FAQ,
    ],
  },
  {
    slug: "gift-add-ons",
    title: "Gift Add-ons | Teddy Bears, Children's Books & Greeting Cards",
    description: "Finish a gift basket with a teddy bear, a Dr. Seuss book or a greeting card, from our gift shop in Manomet, Plymouth, MA.",
    h1: "Gift Add-ons",
    intro: "The finishing touch for a basket: teddy bears, children's books and greeting cards for every occasion.",
    occasions: ["new-baby", "birthday", "get-well", "valentines-day"],
    faqs: [
      { q: "Can I add a teddy bear or a card to a basket?", a: "Yes. Choose add-ons when you build a basket online, or ask us to add them to one of ours." },
      GETTING_IT,
    ],
  },
];

export const categoryCopyBySlug = (slug: string) => CATEGORY_COPY.find((c) => c.slug === slug) ?? null;

/** Where a category's landing page lives. */
export const categoryHref = (slug: string) => CATEGORY_PAGES_ELSEWHERE[slug] ?? `/shop/category/${slug}`;
