/**
 * Service-area pages (D69): /gifts/<area>. One page per area we really serve from the Manomet shop,
 * not one thin page per town. Each says how a gift gets there (pickup, DoorDash delivery where
 * DoorDash delivers, US shipping) and nothing more: no delivery times, fees or radius we haven't
 * agreed. Product lists come from the live catalog.
 */

export type Area = {
  slug: string;
  /** Short label for links, e.g. "Gifts in Plymouth". */
  linkLabel: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  towns: readonly string[];
  /** Products whose title, brand or description match are shown as local favourites. */
  match: RegExp;
  /** Occasion slugs to link to, most relevant first. */
  occasions: readonly string[];
  sections: readonly { heading: string; body: string }[];
  /** `{address}` in an answer becomes the shop's street and town from Store settings. */
  faqs: readonly { q: string; a: string }[];
};

const DOORDASH_NOTE = "DoorDash shows at checkout whether it delivers to the address.";

export const AREAS: readonly Area[] = [
  {
    slug: "plymouth-ma",
    linkLabel: "Gifts in Plymouth",
    name: "Plymouth",
    title: "Gift Baskets & Chocolates in Plymouth, MA | Lodelicious, Manomet",
    description: "Gift baskets, Phillips chocolates, fudge and candy from our shop on Manomet Point Road in Plymouth, MA. Pick up in Manomet, get DoorDash delivery or ship anywhere in the US.",
    h1: "Gifts & Gift Baskets in Plymouth, MA",
    intro:
      "Our shop is in Manomet, in the south of Plymouth. Every gift basket is put together by hand here, and the shelves are full of Phillips chocolates, fudge, candy and treats you can pick up the same visit.",
    towns: ["Manomet", "Downtown Plymouth", "North Plymouth", "Cedarville", "The Pinehills", "White Horse Beach"],
    match: /cranberry|bog|cape cod|assortment|fudge/i,
    occasions: ["birthday", "sympathy", "thank-you", "new-baby", "christmas"],
    sections: [
      {
        heading: "Pick up in Manomet",
        body: "Order online and choose a pickup time at checkout, or come in and choose in person. Custom baskets need notice before pickup, so order those ahead.",
      },
      {
        heading: "Delivery anywhere in Plymouth",
        body: `For a gift delivered across town, from Manomet to North Plymouth, order through DoorDash. ${DOORDASH_NOTE} For a funeral home, an office or a set time, call us first and we'll tell you what's possible.`,
      },
      {
        heading: "A taste of Plymouth for visitors and family away",
        body: "Sending something local to family out of state? Cranberry Bog Frogs, fudge and New England sweets travel well in a basket, and we ship anywhere in the US.",
      },
    ],
    faqs: [
      { q: "Where is the shop?", a: "At {address}. Our opening hours are at the bottom of every page." },
      { q: "Can I get a gift basket delivered in Plymouth today?", a: `Call us to check what is ready today. Ready items can go out through DoorDash; ${DOORDASH_NOTE.toLowerCase()}` },
      { q: "Can I order online and pick up?", a: "Yes. Choose pickup at checkout and pick a time. We'll have it ready at the shop." },
    ],
  },
  {
    slug: "south-shore-ma",
    linkLabel: "South Shore gifts",
    name: "South Shore",
    title: "South Shore Gift Baskets | Kingston, Duxbury, Carver & Plympton, MA",
    description: "Gift baskets and chocolates for Kingston, Duxbury, Carver, Plympton and the South Shore, made by hand in Plymouth, MA. Pickup, DoorDash delivery or US shipping.",
    h1: "Gift Baskets for the South Shore",
    intro:
      "We're a family-owned gift and sweets shop in Plymouth, a short drive from Kingston, Duxbury, Carver and Plympton. Order a basket online for pickup, have it delivered through DoorDash, or ship it.",
    towns: ["Kingston", "Duxbury", "Carver", "Plympton"],
    match: /assortment|turtle|caramel|fudge/i,
    occasions: ["sympathy", "birthday", "thank-you", "anniversary", "christmas"],
    sections: [
      {
        heading: "Three ways to get it there",
        body: `Pick up at our shop in Manomet, order local delivery through DoorDash (${DOORDASH_NOTE.replace(/\.$/, "").toLowerCase()}), or have it shipped. Shipping is priced at checkout from the ZIP code.`,
      },
      {
        heading: "For South Shore businesses",
        body: "Client thank-yous, new-hire welcomes and holiday baskets for a team: tell us how many and your budget per basket, and we'll put together a quote.",
      },
    ],
    faqs: [
      { q: "Do you deliver to Duxbury, Kingston, Carver or Plympton?", a: `Local delivery is through DoorDash. ${DOORDASH_NOTE} You can also pick up in Manomet or have the basket shipped.` },
      { q: "Can I order several baskets for my business?", a: "Yes. See our corporate gifts page or send us a message with the number of baskets and your budget." },
    ],
  },
  {
    slug: "upper-cape-cod",
    linkLabel: "Upper Cape gifts",
    name: "Upper Cape",
    title: "Gift Baskets for Bourne & Sandwich, MA | Cape Cod Gifts from Plymouth",
    description: "Gift baskets, Cape Cod fudge and chocolates for Bourne, Sandwich and the Upper Cape, made by hand in Manomet, Plymouth, MA. Pickup, DoorDash delivery or US shipping.",
    h1: "Gift Baskets for Bourne, Sandwich & the Upper Cape",
    intro:
      "Our Manomet shop sits close to the Cape Cod Canal, so Bourne and Sandwich are near neighbours. We put every basket together by hand, with Cape Cod and New England sweets alongside Phillips chocolates.",
    towns: ["Bourne", "Sandwich"],
    match: /cape cod|cranberry|bog|taffy/i,
    occasions: ["cape-cod", "sympathy", "birthday", "thank-you"],
    sections: [
      {
        heading: "Pickup on the way over the bridge",
        body: "Heading to the Cape? Order online, choose a pickup time and collect your basket at the shop in Manomet.",
      },
      {
        heading: "Delivery and shipping",
        body: `Local delivery is through DoorDash. ${DOORDASH_NOTE} Anywhere else in the US, we ship; shipping is priced at checkout from the ZIP code.`,
      },
    ],
    faqs: [
      { q: "Do you deliver to Bourne or Sandwich?", a: `Local delivery is through DoorDash. ${DOORDASH_NOTE} You can also pick up in Manomet or have the basket shipped.` },
      { q: "Do you have Cape Cod treats?", a: "Yes: see our Cape Cod gift baskets for fudge, Cranberry Bog Frogs and other New England sweets that are in stock." },
    ],
  },
];

export const areaBySlug = (slug: string) => AREAS.find((a) => a.slug === slug) ?? null;
