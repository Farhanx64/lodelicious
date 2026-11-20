import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createProductModels, productKind, type ProductKind } from "../components/builder/product-models";

const cases: [string, string, string, ProductKind][] = [
  ["Phillips Chocolate Dark Chocolate Bar", "Chocolate", "Phillips", "bar"],
  ["Turtles Bars", "Chocolate", "Phillips", "bar"],
  ["Toblerone", "Chocolate", "", "bar"],
  ["Princess Assortment Box", "Chocolate", "Phillips", "chocolates"],
  ["Boxed chocolates", "Chocolate", "", "chocolates"],
  ["Cape Cod Penuche Fudge (no nuts)", "Fudge", "Cape Cod", "fudge"],
  ["Peanut Butter Bark", "Chocolate", "Phillips", "fudge"],
  ["Candy Jar", "Candy", "", "candyJar"],
  ["Gummy Bears", "Candy", "", "candyJar"],
  ["Swedish Candy Bag", "Candy", "", "pouch"],
  ["Chocolate Covered Almonds", "Chocolate", "Phillips", "pouch"],
  ["Roasted Nuts", "Savory", "", "pouch"],
  ["Crackers", "Savory", "", "pouch"],
  ["Popcorn", "Savory", "", "pouch"],
  ["Honey Jar", "Pantry", "", "bottle"],
  ["Sauce Bottle", "Pantry", "", "bottle"],
  ["Tea Tin", "Gifts", "", "tin"],
  ["Lollipops", "Candy", "", "lollipop"],
  ["Flower Pop", "Candy", "", "lollipop"],
  ["Candy Stick", "Candy", "", "lollipop"],
  ["Teddy Bear", "Gifts", "", "plush"],
  ["Ceramic Bowl", "Baby Gifts", "", "plush"],
  ["Classic", "Fudge", "", "fudge"],
  ["Signature Collection", "", "OMNIYA", "chocolates"],
  ["Birthday Gift Box", "Gifts", "", "gift"],
  ["Greeting Cards", "Gift add-ons", "Lodelicious", "gift"],
  ["", "", "", "gift"],
];

describe("product kind", () => {
  it.each(cases)("maps %s (%s, %s) to %s", (title, categoryName, brand, expected) => {
    expect(productKind({ title, categoryName, brand })).toBe(expected);
  });
  it("accepts absent metadata and ignores case", () => {
    expect(productKind({ title: "CHOCOLATE BAR", categoryName: null })).toBe("bar");
  });
});

describe("product model resources", () => {
  it("builds finite, compact silhouettes for every kind without a browser", () => {
    const pool = createProductModels();
    for (const [title, categoryName, brand, kind] of cases) {
      const model = pool.create({ id: title, title, categoryName, brand, premium: true });
      expect(model.userData.kind).toBe(kind);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(0);
      expect(size.y).toBeGreaterThan(0);
      expect(size.z).toBeGreaterThan(0);
      expect(size.length()).toBeLessThan(2.5);
      expect(model.children.length).toBeLessThan(25);
    }
    pool.dispose();
  });
  it("shares resources, preserves stable colours, and disposes even detached models once", () => {
    const pool = createProductModels();
    const product = { id: "stable-id", title: "Chocolate Bar", premium: false };
    const a = pool.create(product), b = pool.create(product);
    const meshesA = a.children as THREE.Mesh[];
    const meshesB = b.children as THREE.Mesh[];
    meshesA.forEach((mesh, i) => {
      expect(mesh.geometry).toBe(meshesB[i].geometry);
      expect(mesh.material).toBe(meshesB[i].material);
    });
    const geoSpies = [...new Set(meshesA.map((m) => m.geometry))].map((g) => vi.spyOn(g, "dispose"));
    const matSpies = [...new Set(meshesA.map((m) => m.material as THREE.Material))].map((m) => vi.spyOn(m, "dispose"));
    a.clear(); b.clear();
    pool.dispose();
    [...geoSpies, ...matSpies].forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
  it("gives premium packaging a metallic gold foil", () => {
    const pool = createProductModels();
    const model = pool.create({ id: "bar", title: "Chocolate Bar", premium: true });
    const foil = (model.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(foil.color.getHex()).toBe(0xb99870);
    expect(foil.metalness).toBeGreaterThan(0.5);
    pool.dispose();
  });
});
