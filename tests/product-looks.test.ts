/**
 * Every product Build a Basket offers on the live site (2026-11-22) gets its own packaging look,
 * not the generic model, and options carried in the title (milk vs dark) change the look.
 */
import { describe, expect, it } from "vitest";

import { productLook } from "@/components/builder/product-looks";

const look = (title: string, brand: string | null = null) => productLook({ title, brand, categoryName: "" });

describe("productLook", () => {
  it.each([
    ["Cape Cod Penuche Fudge (no nuts)", { id: "fudge", flavor: "penuche" }],
    ["Cape Cod Pistachio Fudge", { id: "fudge", flavor: "pistachio" }],
    ["Cape Cod Provisions Chocolate Fudge", { id: "fudge", flavor: "chocolate" }],
    ["Cape Cod Chocolate Sea Salt Caramel Fudge", { id: "fudge", flavor: "chocolateCaramel" }],
    ["Sea Salt Caramel Fudge", { id: "fudge", flavor: "caramel" }],
    ["Black Licorice", { id: "licorice" }],
    ["Chocolate Pretzels — Dark chocolate", { id: "pretzelBag", chocolate: "dark" }],
    ["Chocolate Pretzels — Milk chocolate", { id: "pretzelBag", chocolate: "milk" }],
    ["Hash Bar — Milk chocolate", { id: "hashBar", chocolate: "milk" }],
    ["Cranberry Bog Frogs", { id: "bogFrogs" }],
    ["Mini Dubai Chocolate Bar", { id: "dubaiBar" }],
    ["Peanut Butter Bark", { id: "pbBark" }],
    ["Gourmet Salami ", { id: "salami" }],
  ])("%s", (title, expected) => {
    expect(look(title)).toEqual(expected);
  });

  it("covers every other builder product too", () => {
    const titles = [
      "Chocolate Almond Clusters", "Chocolate Covered Gummy Bears", "Dark Chocolate Sea Salt Caramel", "Dr. Seuss Book",
      "Milk Chocolate Covered Raisins", "Milk Chocolate Sea Salt Caramel", "Phillips Chocolate Covered Turtle Fudge",
      "Phillips Chocolate Dark Chocolate Bar", "Phillips Chocolate Milk Chocolate Bar", "Phillips Chocolate Princess Assortment Box — Window style",
      "Phillips Chocolate S'mores Bar", "Sea Salt Chocolate Caramels (9 pc)", "Sugar-Free Theatre Box", "Swedish Candy Bag", "Teddy Bear",
      "Turtles 9pc Assortment Box", "Turtles Bars — Milk chocolate pecan", "Vegan Bark",
    ];
    expect(titles.filter((t) => look(t, "Phillips Chocolates") === null)).toEqual([]);
  });
});
