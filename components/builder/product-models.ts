import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type ProductKind = "bar" | "chocolates" | "fudge" | "candyJar" | "pouch" | "bottle" | "tin" | "lollipop" | "plush" | "gift";
export type ModelProduct = { id: string; title: string; categoryName?: string | null; brand?: string | null; premium: boolean };

/** Specific packaging in the title wins over a broad category or brand. No browser state. */
export function productKind(product: Pick<ModelProduct, "title" | "categoryName" | "brand">): ProductKind {
  const title = product.title.toLowerCase();
  const classify = (text: string): ProductKind | undefined => {
    if (/\b(fudge|bark)\b/.test(text)) return "fudge";
    if (/\b(lollipops?|candy sticks?|candy canes?|mini pop|flower pop|chocolate rose)\b/.test(text)) return "lollipop";
    if (/\b(teddy|plush|baby|soft toy)\b/.test(text)) return "plush";
    if (/\b(tin|tinned)\b/.test(text)) return "tin";
    if (/\b(bottle|sauce|honey|jam|preserves|syrup)\b/.test(text)) return "bottle";
    if (/\bjar\b/.test(text)) return "candyJar";
    if (/\b(bars?|skybar|toblerone)\b/.test(text)) return "bar";
    if (/\bgift box\b/.test(text)) return "gift";
    if (/\b(box|boxed|assortment|truffles)\b/.test(text)) return "chocolates";
    if (/\b(bag|bagged|pouch|nuts|almonds|cashews|peanuts|crackers|popcorn|pretzels|chips|snacks?|cookies?|biscoff|raisins)\b/.test(text)) return "pouch";
    return undefined;
  };
  return classify(title) ?? classify(product.categoryName?.toLowerCase() ?? "") ??
    (/candy|gummy|gummies|taffy|jelly|licorice|swedish fish|tic tac/.test([title, product.categoryName].join(" ").toLowerCase()) ? "candyJar" :
      /chocolat|phillips|omniya/i.test([title, product.categoryName, product.brand].join(" ")) ? "chocolates" : "gift");
}

const PALETTE = [0xd58f9c, 0x9c4459, 0xb99870, 0xefd5ce, 0xeadccf, 0x3b2f25];
function hash(text: string) { return [...text].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0); }

/** One resource pool per preview. Instances borrow resources; only this pool disposes them. */
export function createProductModels() {
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    softBox: new RoundedBoxGeometry(1, 1, 1, 1, 0.09),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    shoulder: new THREE.CylinderGeometry(0.5, 1, 1, 16),
    loop: new THREE.TorusGeometry(1, 0.15, 6, 16),
    plane: new THREE.PlaneGeometry(1, 1),
    // A gusseted pouch: narrow sealed ends, full middle, faceted folded sides.
    pouch: new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.78, 0), new THREE.Vector2(1, 0.2),
      new THREE.Vector2(0.95, 0.75), new THREE.Vector2(0.72, 1), new THREE.Vector2(0, 1),
    ], 8),
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const textures = new Map<string, THREE.CanvasTexture>();
  function material(color: number, metalness = 0, opacity = 1) {
    const key = `${color}:${metalness}:${opacity}`;
    let m = materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.28 : 0.65, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
      materials.set(key, m);
    }
    return m;
  }
  type Shape = keyof typeof geometries;
  type Dimensions = [number, number, number];
  function part(group: THREE.Group, shape: Shape, m: THREE.Material, scale: Dimensions, position: Dimensions) {
    const mesh = new THREE.Mesh(geometries[shape], m);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.castShadow = !m.transparent;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function label(group: THREE.Group, product: ModelProduct, text: string, width: number, height: number, y: number, z: number) {
    // Labels contain only typography drawn locally, never product photos or remote assets.
    const brand = (product.brand || "Lodelicious").slice(0, 26).toUpperCase();
    const key = `label:${brand}:${text}`;
    let m = materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: 0xfff8ec, roughness: 0.8 });
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 192;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#fff8ec"; ctx.fillRect(0, 0, 256, 192);
          ctx.strokeStyle = "#b99870"; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 236, 172);
          ctx.textAlign = "center"; ctx.fillStyle = "#9c4459"; ctx.font = "18px serif";
          ctx.fillText(brand, 128, 49, 220);
          ctx.font = "bold 27px serif"; ctx.fillStyle = "#3b2f25"; ctx.fillText(text, 128, 104, 218);
          ctx.font = "13px sans-serif"; ctx.fillText("A LITTLE DELIGHT", 128, 149);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          textures.set(key, texture); m.map = texture;
        }
      }
      materials.set(key, m);
    }
    part(group, "plane", m, [width, height, 1], [0, y, z]);
  }

  function create(product: ModelProduct): THREE.Group {
    const group = new THREE.Group();
    const kind = productKind(product);
    group.userData.kind = kind;
    const color = PALETTE[hash(product.id) % PALETTE.length];
    const wrap = material(color);
    const cream = material(0xeadccf);
    const ink = material(0x3b2f25);
    const accent = material(product.premium ? 0xb99870 : 0x9c4459, product.premium ? 0.8 : 0.1);
    const foil = material(product.premium ? 0xb99870 : 0xdad5ca, 0.85);
    const box = (m: THREE.Material, s: Dimensions, p: Dimensions) => part(group, "softBox", m, s, p);
    const cylinder = (m: THREE.Material, s: Dimensions, p: Dimensions) => part(group, "cylinder", m, s, p);
    const ball = (m: THREE.Material, s: Dimensions, p: Dimensions) => part(group, "sphere", m, s, p);
    const bow = (y: number, z: number) => {
      [-1, 1].forEach((sign) => {
        const loop = part(group, "loop", accent, [0.17, 0.09, 0.08], [sign * 0.14, y, z]);
        loop.rotation.z = sign * 0.3;
      });
      ball(accent, [0.07, 0.07, 0.07], [0, y, z]);
    };
    const factories: Record<ProductKind, () => void> = {
      bar: () => {
        box(foil, [0.66, 1.48, 0.2], [0, 0.74, 0]);
        box(wrap, [0.68, 1.2, 0.23], [0, 0.64, 0]);
        for (let i = 0; i < 6; i++) box(foil, [0.025, 0.16, 0.025], [-0.26 + i * 0.105, 1.39, 0.105]);
        box(accent, [0.69, 0.055, 0.24], [0, 1.19, 0]);
        label(group, product, "CHOCOLATE", 0.55, 0.64, 0.71, 0.12);
      },
      chocolates: () => {
        box(wrap, [1.03, 0.87, 0.4], [0, 0.44, 0]);
        box(accent, [1.08, 0.09, 0.44], [0, 0.89, 0]);
        box(cream, [0.1, 0.88, 0.42], [-0.32, 0.45, 0]);
        label(group, product, "CHOCOLATES", 0.65, 0.49, 0.46, 0.21);
        bow(0.91, 0.09);
      },
      fudge: () => {
        box(cream, [0.91, 0.85, 0.32], [0, 0.43, 0]);
        // Four exposed, scored pieces sitting in a paper tray.
        for (let i = 0; i < 4; i++) box(material(i % 2 ? 0x704534 : 0x845740), [0.37, 0.34, 0.15], [(i % 2 - 0.5) * 0.4, 0.25 + Math.floor(i / 2) * 0.37, 0.2]);
        box(wrap, [0.94, 0.29, 0.46], [0, 0.38, 0]);
        label(group, product, "FUDGE", 0.66, 0.24, 0.38, 0.24);
        box(foil, [0.94, 0.035, 0.46], [0, 0.55, 0]);
      },
      candyJar: () => {
        cylinder(material(0xe4eeea, 0.12, 0.2), [0.38, 1.05, 0.38], [0, 0.56, 0]);
        for (let i = 0; i < 15; i++) {
          const angle = i * 2.4 + hash(product.id) % 6;
          ball(material(PALETTE[i % PALETTE.length]), [0.11, 0.085, 0.1], [Math.cos(angle) * 0.23, 0.16 + Math.floor(i / 3) * 0.18, Math.sin(angle) * 0.23]);
        }
        cylinder(foil, [0.4, 0.13, 0.4], [0, 1.12, 0]);
        cylinder(cream, [0.38, 0.06, 0.38], [0, 0.04, 0]);
        label(group, product, "SWEETS", 0.43, 0.32, 0.57, 0.385);
      },
      pouch: () => {
        part(group, "pouch", wrap, [0.48, 1.16, 0.28], [0, 0.04, 0]);
        [0.04, 1.21].forEach((y) => {
          box(accent, [0.76, 0.12, 0.12], [0, y, 0]);
          for (let i = 0; i < 8; i++) box(wrap, [0.025, 0.11, 0.015], [-0.32 + i * 0.09, y, 0.064]);
        });
        label(group, product, /nuts|almonds|cashews|peanuts/i.test(product.title) ? "NUTS" : "SNACKS", 0.58, 0.52, 0.68, 0.276);
      },
      bottle: () => {
        const honey = /honey|jam|preserves/i.test(product.title);
        cylinder(material(honey ? 0xbc802f : 0x675344, 0.15), [0.32, 0.91, 0.32], [0, 0.48, 0]);
        part(group, "shoulder", wrap, [0.32, 0.2, 0.32], [0, 1.02, 0]);
        cylinder(foil, [0.18, honey ? 0.12 : 0.35, 0.18], [0, honey ? 1.15 : 1.25, 0]);
        label(group, product, honey ? "PANTRY" : "SAUCE", 0.46, 0.48, 0.57, 0.325);
      },
      tin: () => {
        cylinder(wrap, [0.43, 0.81, 0.43], [0, 0.43, 0]);
        [0.06, 0.86].forEach((y) => cylinder(foil, [0.45, 0.09, 0.45], [0, y, 0]));
        label(group, product, "TREATS", 0.54, 0.44, 0.46, 0.435);
      },
      lollipop: () => {
        cylinder(cream, [0.035, 1.17, 0.035], [0, 0.59, 0]);
        ball(accent, [0.4, 0.4, 0.12], [0, 1.3, 0]);
        for (let i = 0; i < 3; i++) part(group, "loop", i % 2 ? wrap : cream, [0.29 - i * 0.09, 0.29 - i * 0.09, 0.1], [0, 1.3, 0.105]);
        bow(0.9, 0.03);
      },
      plush: () => {
        ball(cream, [0.35, 0.43, 0.26], [0, 0.49, 0]);
        ball(cream, [0.31, 0.3, 0.27], [0, 1.02, 0]);
        [-1, 1].forEach((sign) => {
          ball(cream, [0.13, 0.14, 0.1], [sign * 0.25, 1.25, 0]);
          ball(cream, [0.17, 0.24, 0.16], [sign * 0.34, 0.59, 0]);
          ball(wrap, [0.19, 0.17, 0.22], [sign * 0.23, 0.16, 0.12]);
          ball(ink, [0.027, 0.035, 0.025], [sign * 0.11, 1.08, 0.25]);
        });
        ball(wrap, [0.15, 0.11, 0.09], [0, 0.96, 0.25]);
        ball(ink, [0.045, 0.035, 0.025], [0, 1, 0.335]);
        bow(0.75, 0.26);
      },
      gift: () => {
        box(wrap, [0.78, 0.8, 0.65], [0, 0.41, 0]);
        box(cream, [0.84, 0.12, 0.71], [0, 0.85, 0]);
        box(accent, [0.13, 0.91, 0.73], [0, 0.46, 0]);
        box(accent, [0.85, 0.91, 0.1], [0, 0.46, 0]);
        bow(0.98, 0);
      },
    };
    factories[kind]();
    // Keep hard containers upright; soft packaging nestles against adjacent items.
    group.rotation.z = (hash(product.id) % 2 ? 1 : -1) * (kind === "pouch" ? 0.13 : kind === "bar" ? 0.07 : 0);
    group.rotation.x = kind === "fudge" || kind === "chocolates" ? -0.12 : 0;
    group.userData.height = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y;
    return group;
  }
  return {
    create,
    dispose() {
      Object.values(geometries).forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      materials.clear(); textures.clear();
    },
  };
}
