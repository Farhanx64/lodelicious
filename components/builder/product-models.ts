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

/**
 * The shop's packaging look (owner, 2026-11-20: "it has to look Lodelicious"): blush, rose, ivory
 * and gold only, satin ribbons, cellophane, and an ivory label with the bow mark and the product's
 * own name in the shop's serif. Chocolate brown appears only where the treat itself shows.
 */
const BRAND = { blush: 0xefd5ce, rose: 0xd58f9c, deep: 0x9c4459, ivory: 0xf7f0ea, linen: 0xeadccf, gold: 0xb99870, cocoa: 0x5b3a2c, milk: 0x8a5a3c };
const WRAPS = [BRAND.rose, BRAND.deep, 0xc9707f, 0xe2a3ad];
const CANDY = [BRAND.rose, BRAND.blush, 0xf3c6c9, BRAND.gold, 0xfaf3ec, 0xe8a7b4];
function hash(text: string) { return [...text].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0); }

/** "Phillips Chocolate Dark Chocolate Bar" → ["Dark Chocolate", "Bar"]: brand dropped, two short lines. */
function labelLines(product: ModelProduct): string[] {
  let t = product.title.replace(/\(.*?\)/g, "");
  if (product.brand) t = t.replace(new RegExp(product.brand.replace(/s$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?", "ig"), "");
  t = t.replace(/\b(phillips|chocolates?)\b(?=.*\bchocolate\b)/i, "").replace(/\s+/g, " ").trim() || product.title;
  const words = t.split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 14) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.slice(0, 2);
}

/** One resource pool per preview. Instances borrow resources; only this pool disposes them. */
export function createProductModels() {
  const geometries = {
    softBox: new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 28),
    loop: new THREE.TorusGeometry(1, 0.28, 10, 24),
    plane: new THREE.PlaneGeometry(1, 1),
    // A cellophane gift bag: flat base, full body, gathered neck.
    bag: new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.8, 0.02), new THREE.Vector2(0.98, 0.25), new THREE.Vector2(0.95, 0.7),
      new THREE.Vector2(0.55, 0.95), new THREE.Vector2(0.18, 1.02), new THREE.Vector2(0.32, 1.25), new THREE.Vector2(0.05, 1.3),
    ], 24),
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const textures = new Map<string, THREE.CanvasTexture>();

  type Finish = "paper" | "gloss" | "foil" | "satin" | "glass" | "cello" | "plush" | "treat";
  function material(color: number, finish: Finish = "paper") {
    const key = `${color}:${finish}`;
    let m = materials.get(key);
    if (!m) {
      const base = { color };
      m =
        finish === "foil" ? new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.9, roughness: 0.22, clearcoat: 0.6 })
        : finish === "gloss" ? new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 })
        : finish === "satin" ? new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.35 })
        : finish === "glass" || finish === "cello" ? new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.05, metalness: 0, transparent: true, opacity: finish === "glass" ? 0.28 : 0.22, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide })
        : finish === "plush" ? new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xfff6ec), sheenRoughness: 0.8 })
        : finish === "treat" ? new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.45, clearcoat: 0.3 })
        : new THREE.MeshStandardMaterial({ ...base, roughness: 0.7 });
      materials.set(key, m);
    }
    return m;
  }

  type Shape = keyof typeof geometries;
  type V3 = [number, number, number];
  function part(group: THREE.Group, shape: Shape, m: THREE.Material, scale: V3, position: V3, rotation?: V3) {
    const mesh = new THREE.Mesh(geometries[shape], m);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = !m.transparent;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  /** Ivory label: gold rule, the bow mark, LODELICIOUS, and the product's name in the shop serif. */
  function labelMaterial(product: ModelProduct) {
    const lines = labelLines(product);
    const key = `label:${lines.join("|")}:${product.premium}`;
    let m = materials.get(key);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({ color: 0xfffaf3, roughness: 0.75 });
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 384; canvas.height = 288;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const serifVar = getComputedStyle(document.documentElement).getPropertyValue("--font-cormorant").trim();
        const serif = `${serifVar ? `${serifVar}, ` : ""}"Cormorant Garamond", Georgia, serif`;
        ctx.fillStyle = "#fffaf3"; ctx.fillRect(0, 0, 384, 288);
        ctx.strokeStyle = "#b99870"; ctx.lineWidth = 5; ctx.strokeRect(14, 14, 356, 260);
        ctx.lineWidth = 1.5; ctx.strokeRect(24, 24, 336, 240);
        // Bow mark
        ctx.strokeStyle = "#9c4459"; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.ellipse(176, 58, 16, 9, -0.35, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(208, 58, 16, 9, 0.35, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(188, 64); ctx.lineTo(178, 84); ctx.moveTo(196, 64); ctx.lineTo(206, 84); ctx.stroke();
        ctx.fillStyle = "#9c4459"; ctx.beginPath(); ctx.arc(192, 60, 5, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#735a39"; ctx.font = `600 22px ${serif}`;
        ctx.fillText("L O D E L I C I O U S", 192, 112, 320);
        ctx.fillStyle = "#3b2f25"; ctx.font = `600 ${lines.length > 1 ? 40 : 46}px ${serif}`;
        lines.forEach((line, i) => ctx.fillText(line, 192, (lines.length > 1 ? 162 : 180) + i * 46, 320));
        ctx.fillStyle = product.premium ? "#b99870" : "#d58f9c"; ctx.fillRect(152, 250, 80, 3);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.set(key, texture); m.map = texture;
      }
    }
    materials.set(key, m);
    return m;
  }

  function create(product: ModelProduct): THREE.Group {
    const group = new THREE.Group();
    const kind = productKind(product);
    group.userData.kind = kind;
    const h = hash(product.id);
    const wrapColor = WRAPS[h % WRAPS.length];
    const ribbonColor = wrapColor === BRAND.deep ? BRAND.blush : BRAND.deep;
    const wrap = material(wrapColor, "gloss");
    const ivory = material(BRAND.ivory);
    const ribbon = material(ribbonColor, "satin");
    const foil = product.premium ? material(BRAND.gold, "foil") : material(0xe9d2c8, "foil");
    const label = labelMaterial(product);
    const box = (m: THREE.Material, s: V3, p: V3, r?: V3) => part(group, "softBox", m, s, p, r);
    const cyl = (m: THREE.Material, s: V3, p: V3, r?: V3) => part(group, "cylinder", m, s, p, r);
    const ball = (m: THREE.Material, s: V3, p: V3) => part(group, "sphere", m, s, p);
    const tag = (w: number, hgt: number, p: V3, r?: V3) => part(group, "plane", label, [w, hgt, 1], p, r);
    /** Satin bow: two loops, a knot and two tails. */
    const bow = (y: number, z: number, s = 1, m = ribbon) => {
      [-1, 1].forEach((sign) => {
        part(group, "loop", m, [0.15 * s, 0.09 * s, 0.1 * s], [sign * 0.13 * s, y, z], [0, 0, sign * 0.35]);
        part(group, "box", m, [0.05 * s, 0.2 * s, 0.012], [sign * 0.06 * s, y - 0.1 * s, z + 0.01], [0, 0, sign * 0.4]);
      });
      ball(m, [0.055 * s, 0.05 * s, 0.05 * s], [0, y, z]);
    };

    const factories: Record<ProductKind, () => void> = {
      bar: () => {
        box(foil, [0.6, 1.36, 0.17], [0, 0.68, 0]);
        box(wrap, [0.63, 1.04, 0.2], [0, 0.6, 0]);
        box(ribbon, [0.64, 0.06, 0.21], [0, 1.0, 0]);
        tag(0.5, 0.38, [0, 0.6, 0.104]);
      },
      chocolates: () => {
        box(wrap, [1.0, 0.62, 0.62], [0, 0.31, 0]);
        box(ivory, [1.04, 0.22, 0.66], [0, 0.6, 0]);
        box(ribbon, [0.1, 0.24, 0.67], [0.28, 0.6, 0]);
        box(ribbon, [0.1, 0.62, 0.025], [0.28, 0.31, 0.315]);
        tag(0.5, 0.38, [-0.16, 0.31, 0.314]);
        bow(0.74, 0.12, 1, ribbon);
      },
      fudge: () => {
        box(ivory, [0.95, 0.5, 0.5], [0, 0.25, 0]);
        // The fudge shows through a window in the lid: four scored squares.
        for (let i = 0; i < 4; i++) box(material(i % 2 ? BRAND.milk : 0xa7774f, "treat"), [0.2, 0.08, 0.2], [-0.33 + i * 0.22, 0.52, 0.02]);
        box(material(0xffffff, "cello"), [0.88, 0.04, 0.42], [0, 0.56, 0]);
        box(foil, [0.97, 0.05, 0.52], [0, 0.4, 0]);
        tag(0.46, 0.3, [0, 0.22, 0.253]);
      },
      candyJar: () => {
        cyl(material(0xffffff, "glass"), [0.38, 0.92, 0.38], [0, 0.48, 0]);
        for (let i = 0; i < 12; i++) {
          const a = i * 2.4 + (h % 6);
          ball(material(CANDY[(i + h) % CANDY.length], "treat"), [0.1, 0.1, 0.1], [Math.cos(a) * 0.22, 0.14 + Math.floor(i / 3) * 0.19, Math.sin(a) * 0.22]);
        }
        cyl(foil, [0.41, 0.1, 0.41], [0, 0.98, 0]);
        cyl(ribbon, [0.395, 0.05, 0.395], [0, 0.88, 0]);
        tag(0.42, 0.32, [0, 0.46, 0.39]);
        bow(0.88, 0.4, 0.8);
      },
      pouch: () => {
        // Cellophane gift bag with the treats showing, gathered with a satin bow.
        part(group, "bag", material(0xffffff, "cello"), [0.44, 0.95, 0.3], [0, 0, 0]);
        const nut = /nut|almond|cashew|peanut|raisin|pretzel|cracker/i.test(product.title);
        for (let i = 0; i < 8; i++) {
          const a = i * 2.2 + (h % 5);
          ball(material(nut ? (i % 2 ? 0xc49a6c : BRAND.milk) : CANDY[(i + h) % CANDY.length], "treat"), [0.11, 0.09, 0.1], [Math.cos(a) * 0.22, 0.12 + Math.floor(i / 3) * 0.17, Math.sin(a) * 0.12]);
        }
        cyl(ribbon, [0.12, 0.05, 0.1], [0, 0.98, 0]);
        tag(0.36, 0.27, [0, 0.42, 0.17]);
        bow(1.0, 0.06, 0.9);
      },
      bottle: () => {
        const honey = /honey|jam|preserves/i.test(product.title);
        cyl(material(honey ? 0xc98a38 : 0x6b3f2e, "glass"), [0.3, 0.86, 0.3], [0, 0.45, 0]);
        cyl(material(honey ? 0xc98a38 : 0x6b3f2e, "treat"), [0.27, 0.7, 0.27], [0, 0.38, 0]);
        cyl(foil, [0.32, 0.14, 0.32], [0, 0.95, 0]);
        cyl(material(0xf3e3d3), [0.36, 0.05, 0.36], [0, 1.03, 0]);
        tag(0.4, 0.3, [0, 0.42, 0.305]);
        bow(0.86, 0.3, 0.7);
      },
      tin: () => {
        cyl(wrap, [0.42, 0.66, 0.42], [0, 0.33, 0]);
        cyl(foil, [0.44, 0.12, 0.44], [0, 0.66, 0]);
        cyl(ribbon, [0.425, 0.06, 0.425], [0, 0.12, 0]);
        tag(0.46, 0.34, [0, 0.36, 0.425]);
      },
      lollipop: () => {
        cyl(ivory, [0.03, 1.0, 0.03], [0, 0.5, 0]);
        cyl(material(BRAND.rose, "treat"), [0.32, 0.12, 0.32], [0, 1.22, 0], [Math.PI / 2, 0, 0]);
        part(group, "loop", material(0xfaf3ec, "treat"), [0.2, 0.2, 0.12], [0, 1.22, 0.04]);
        part(group, "loop", material(BRAND.deep, "treat"), [0.1, 0.1, 0.1], [0, 1.22, 0.05]);
        ball(material(0xffffff, "cello"), [0.38, 0.38, 0.14], [0, 1.22, 0]);
        bow(0.9, 0.03, 0.8);
      },
      plush: () => {
        const fur = material(0xe8d3bd, "plush");
        const muzzle = material(BRAND.ivory, "plush");
        const ink = material(0x3b2f25, "gloss");
        ball(fur, [0.34, 0.4, 0.28], [0, 0.45, 0]);
        ball(fur, [0.3, 0.28, 0.27], [0, 0.98, 0]);
        [-1, 1].forEach((sign) => {
          ball(fur, [0.11, 0.11, 0.08], [sign * 0.23, 1.22, 0]);
          ball(muzzle, [0.06, 0.06, 0.04], [sign * 0.23, 1.22, 0.05]);
          ball(fur, [0.13, 0.22, 0.13], [sign * 0.33, 0.55, 0.05]);
          ball(fur, [0.15, 0.13, 0.19], [sign * 0.2, 0.12, 0.12]);
          ball(ink, [0.03, 0.035, 0.025], [sign * 0.1, 1.04, 0.25]);
        });
        ball(muzzle, [0.13, 0.1, 0.09], [0, 0.93, 0.24]);
        ball(ink, [0.04, 0.03, 0.025], [0, 0.97, 0.32]);
        bow(0.72, 0.26, 1.1, material(BRAND.rose, "satin"));
      },
      gift: () => {
        box(wrap, [0.74, 0.66, 0.62], [0, 0.33, 0]);
        box(ivory, [0.8, 0.14, 0.68], [0, 0.69, 0]);
        box(ribbon, [0.1, 0.82, 0.7], [0, 0.39, 0]);
        box(ribbon, [0.82, 0.16, 0.1], [0, 0.69, 0]);
        tag(0.26, 0.2, [0.22, 0.32, 0.315], [0, 0, 0.12]);
        bow(0.82, 0, 1.1);
      },
    };
    factories[kind]();
    // Soft packaging leans into its neighbours; boxes sit a touch back so their fronts face the viewer.
    group.rotation.z = (h % 2 ? 1 : -1) * (kind === "pouch" ? 0.1 : kind === "bar" ? 0.08 : 0.02);
    group.rotation.x = kind === "bar" ? -0.18 : kind === "fudge" || kind === "chocolates" ? -0.1 : 0;
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
