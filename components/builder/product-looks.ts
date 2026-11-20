/**
 * Accurate packaging for the products the shop actually stocks (owner, 2026-11-20: "make the
 * products more accurate"). Each look copies the real item from its catalog photo: Phillips's red
 * "Handmade since 1925" boxes and Classic bar sleeves, Lodelicious stand-up pouches, bare Cape Cod
 * fudge cubes, and so on. Drawn in code (shapes and canvas lettering), never the photos themselves.
 * Products without a look fall back to the generic kind models in product-models.ts.
 */
import * as THREE from "three";

import type { ModelProduct } from "./product-models";

export type Look =
  | { id: "phillipsBox"; name: string; w: number; h: number; d: number; window: "none" | "grid" | "turtles" | "oval" | "round" | "label"; ribbon: "white" | "gold" | null }
  | { id: "phillipsBar"; flavor: "DARK" | "MILK" | "S'MORES" }
  | { id: "hashBar" }
  | { id: "pouch"; color: "gold" | "white" | "pink"; fill: "gummies" | "caramels" | "raisins" | "candy"; name: string }
  | { id: "clearBag"; fill: "pretzels" | "clusters" }
  | { id: "bogFrogs" }
  | { id: "dubaiBar" }
  | { id: "pbBark" }
  | { id: "fudge"; flavor: "penuche" | "pistachio" | "chocolate" | "caramel" }
  | { id: "licorice" }
  | { id: "teddy" }
  | { id: "book" };

/** The real packaging for a stocked product, or null to use the generic kind model. */
export function productLook(p: Pick<ModelProduct, "title" | "brand" | "categoryName">): Look | null {
  const t = p.title.toLowerCase();
  const phillips = /phillips/i.test(`${p.title} ${p.brand ?? ""}`);
  if (/fudge/.test(t) && !/covered turtle fudge/.test(t)) {
    return { id: "fudge", flavor: /penuche/.test(t) ? "penuche" : /pistachio/.test(t) ? "pistachio" : /caramel/.test(t) ? "caramel" : "chocolate" };
  }
  if (/princess/.test(t)) return { id: "phillipsBox", name: "Princess Assortment", w: 1.0, h: 0.92, d: 0.24, window: "none", ribbon: "white" };
  if (/sea salt chocolate caramels/.test(t)) return { id: "phillipsBox", name: "Sea Salt Caramels", w: 0.86, h: 0.86, d: 0.24, window: "grid", ribbon: "white" };
  if (/turtles? 9 ?pc|turtles?.*assortment/.test(t)) return { id: "phillipsBox", name: "Turtles", w: 0.86, h: 0.86, d: 0.24, window: "turtles", ribbon: null };
  if (/theatre/.test(t)) return { id: "phillipsBox", name: "Sugar-Free Theatre Box", w: 1.1, h: 0.56, d: 0.3, window: "none", ribbon: "gold" };
  if (/turtles? bars?/.test(t)) return { id: "phillipsBox", name: "Turtle Bar", w: 0.56, h: 0.95, d: 0.2, window: "oval", ribbon: null };
  if (/vegan bark/.test(t)) return { id: "phillipsBox", name: "Vegan Bark", w: 0.78, h: 0.74, d: 0.2, window: "round", ribbon: null };
  if (/covered turtle fudge/.test(t)) return { id: "phillipsBox", name: "Turtle Fudge", w: 0.98, h: 0.7, d: 0.3, window: "label", ribbon: null };
  if (phillips && /s.?mores bar/.test(t)) return { id: "phillipsBar", flavor: "S'MORES" };
  if (phillips && /milk chocolate bar/.test(t)) return { id: "phillipsBar", flavor: "MILK" };
  if (phillips && /dark chocolate bar/.test(t)) return { id: "phillipsBar", flavor: "DARK" };
  if (/hash/.test(t)) return { id: "hashBar" };
  if (/gummy/.test(t)) return { id: "pouch", color: "gold", fill: "gummies", name: "Chocolate Covered Gummy Bears" };
  if (/sea salt caramel/.test(t)) return { id: "pouch", color: "gold", fill: "caramels", name: /milk/.test(t) ? "Milk Chocolate Sea Salt Caramel" : "Dark Chocolate Sea Salt Caramel" };
  if (/raisin/.test(t)) return { id: "pouch", color: "white", fill: "raisins", name: "Milk Chocolate Covered Raisins" };
  if (/swedish/.test(t)) return { id: "pouch", color: "pink", fill: "candy", name: "Swedish Candy" };
  if (/pretzel/.test(t)) return { id: "clearBag", fill: "pretzels" };
  if (/almond clusters?/.test(t)) return { id: "clearBag", fill: "clusters" };
  if (/bog frog/.test(t)) return { id: "bogFrogs" };
  if (/dubai|kunafa/.test(t)) return { id: "dubaiBar" };
  if (/peanut butter bark/.test(t)) return { id: "pbBark" };
  if (/licorice/.test(t)) return { id: "licorice" };
  if (/teddy/.test(t)) return { id: "teddy" };
  if (/seuss|\bbook\b/.test(t)) return { id: "book" };
  return null;
}

type V3 = [number, number, number];
export type LookKit = {
  group: THREE.Group;
  box: (m: THREE.Material, s: V3, p: V3, r?: V3) => THREE.Mesh;
  hard: (m: THREE.Material, s: V3, p: V3, r?: V3) => THREE.Mesh;
  cyl: (m: THREE.Material, s: V3, p: V3, r?: V3) => THREE.Mesh;
  ball: (m: THREE.Material, s: V3, p: V3) => THREE.Mesh;
  ring: (m: THREE.Material, s: V3, p: V3, r?: V3) => THREE.Mesh;
  bag: (m: THREE.Material, s: V3, p: V3) => THREE.Mesh;
  plane: (m: THREE.Material, s: [number, number], p: V3, r?: V3) => THREE.Mesh;
  mat: (color: number, finish?: "paper" | "gloss" | "foil" | "satin" | "glass" | "cello" | "plush" | "treat") => THREE.Material;
  /** A cached canvas-painted material; `w`×`h` is the face size, so lettering keeps its proportions. */
  paint: (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number, serif: string) => void) => THREE.Material;
  bow: (y: number, z: number, s?: number, m?: THREE.Material) => void;
};

const RED = 0xa3192b;
const CHOC = { dark: 0x3a2318, milk: 0x7b4a2d, caramel: 0x9a5a2c };

function chocolates(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, turtles: boolean) {
  g.fillStyle = "#2a160f";
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
  const cw = w / 3, ch = h / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const cx = x + cw * (c + 0.5), cy = y + ch * (r + 0.5), rad = Math.min(cw, ch) * 0.36;
    g.fillStyle = "#c9a35a"; g.beginPath(); g.arc(cx, cy + 2, rad * 1.12, 0, Math.PI * 2); g.fill();
    const grd = g.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    const milk = (r + c) % 2 === 0;
    grd.addColorStop(0, milk ? "#a86f45" : "#6a3f28"); grd.addColorStop(1, milk ? "#5e3520" : "#2d1810");
    g.fillStyle = grd; g.beginPath();
    if (turtles) for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.ellipse(cx + Math.cos(a) * rad * 0.25, cy + Math.sin(a) * rad * 0.25, rad * 0.78, rad * 0.62, a, 0, Math.PI * 2); }
    else g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    if (!turtles && (r * 3 + c) % 3 === 0) { g.strokeStyle = "#e8d2b0"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - rad * 0.6, cy); g.quadraticCurveTo(cx, cy - rad * 0.5, cx + rad * 0.6, cy); g.stroke(); }
  }
}

function phillipsFront(look: Extract<Look, { id: "phillipsBox" }>) {
  return (g: CanvasRenderingContext2D, W: number, H: number, serif: string) => {
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#b52133"); grd.addColorStop(1, "#8a1222");
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#d9b46a"; g.lineWidth = W * 0.012; g.strokeRect(W * 0.04, H * 0.04, W * 0.92, H * 0.92);
    g.lineWidth = W * 0.004; g.strokeRect(W * 0.065, H * 0.065, W * 0.87, H * 0.87);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e7c98a";
    const top = look.window === "none" || look.window === "label" ? H * 0.3 : H * 0.13;
    g.font = `600 ${Math.round(W * 0.075)}px ${serif}`;
    g.fillText("PHILLIPS CHOCOLATES", W / 2, top, W * 0.84);
    g.font = `${Math.round(W * 0.04)}px ${serif}`; g.fillStyle = "#f3e2c0";
    g.fillText("HANDMADE SINCE 1925", W / 2, top + W * 0.07, W * 0.8);
    const win = { x: W * 0.16, y: top + W * 0.12, w: W * 0.68, h: H * 0.86 - (top + W * 0.12) - H * 0.1 };
    if (look.window === "grid" || look.window === "turtles") chocolates(g, win.x, win.y, win.w, win.h, look.window === "turtles");
    if (look.window === "oval" || look.window === "round") {
      const cx = W / 2, cy = win.y + win.h / 2, rx = win.w / 2, ry = look.window === "round" ? Math.min(win.w, win.h) / 2 : win.h / 2;
      const choc = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 4, cx, cy, Math.max(rx, ry));
      choc.addColorStop(0, "#6e4129"); choc.addColorStop(1, "#2a160f");
      g.fillStyle = choc; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c79a66";
      for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(cx + Math.cos(k * 2.3) * rx * 0.5, cy + Math.sin(k * 1.7) * ry * 0.5, rx * 0.09, ry * 0.05, k, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = "#d9b46a"; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    }
    if (look.window === "label") {
      g.fillStyle = "#f6ead3"; g.beginPath(); g.ellipse(W / 2, H * 0.66, W * 0.3, H * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#d9b46a"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#8a1222"; g.font = `italic 600 ${Math.round(W * 0.05)}px ${serif}`; g.fillText("Chocolate Covered", W / 2, H * 0.62, W * 0.5);
      g.fillText("Turtle Fudge", W / 2, H * 0.7, W * 0.5);
    } else if (look.window === "none") {
      g.fillStyle = "#f3e2c0"; g.font = `italic ${Math.round(W * 0.06)}px ${serif}`; g.fillText(look.name, W / 2, H * 0.62, W * 0.8);
    } else {
      g.fillStyle = "#f3e2c0"; g.font = `italic ${Math.round(W * 0.055)}px ${serif}`; g.fillText(look.name, W / 2, H * 0.9, W * 0.8);
    }
  };
}

function pouchFront(look: Extract<Look, { id: "pouch" }>) {
  return (g: CanvasRenderingContext2D, W: number, H: number, serif: string) => {
    const bg = look.color === "gold" ? ["#e7c77d", "#b98a3a"] : look.color === "pink" ? ["#f6c3cf", "#ec9fb2"] : ["#ffffff", "#ece7e2"];
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, bg[1]); grd.addColorStop(0.5, bg[0]); grd.addColorStop(1, bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // Window onto the contents
    const wx = W * 0.14, wy = H * 0.52, ww = W * 0.72, wh = H * 0.36;
    g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.roundRect(wx, wy, ww, wh, 12); g.fill();
    const colors = look.fill === "candy" ? ["#f28fb0", "#fcd6e2", "#a9dcf0", "#fff3a8", "#ffffff", "#e35d8a"] : look.fill === "raisins" ? ["#5b3420", "#6e4129", "#4a2a19"] : ["#5e3520", "#7b4a2d", "#3e2216"];
    for (let k = 0; k < (look.fill === "raisins" ? 60 : 26); k++) {
      const x = wx + 10 + ((k * 37) % (ww - 20)), y = wy + 10 + ((k * 53) % (wh - 20));
      const s = look.fill === "raisins" ? W * 0.025 : look.fill === "caramels" ? W * 0.06 : W * 0.045;
      g.fillStyle = colors[k % colors.length]; g.beginPath();
      if (look.fill === "caramels") g.roundRect(x - s / 2, y - s / 2, s, s, 4);
      else if (look.fill === "gummies") g.ellipse(x, y, s * 0.7, s, 0, 0, Math.PI * 2);
      else g.arc(x, y, s / 2, 0, Math.PI * 2);
      g.fill();
    }
    // Round Lodelicious label
    const cx = W / 2, cy = H * 0.3, r = W * 0.27;
    g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#b99870"; g.lineWidth = 3; g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#3b2f25";
    g.font = `italic 600 ${Math.round(W * 0.085)}px ${serif}`; g.fillText("Lodelicious", cx, cy - r * 0.35, r * 1.8);
    g.font = `${Math.round(W * 0.038)}px ${serif}`; g.fillText("Gifts & Sweets", cx, cy - r * 0.05, r * 1.6);
    g.font = `italic ${Math.round(W * 0.036)}px ${serif}`; g.fillStyle = "#735a39";
    const words = look.name.split(" "); const mid = Math.ceil(words.length / 2);
    g.fillText(words.slice(0, mid).join(" "), cx, cy + r * 0.32, r * 1.6);
    g.fillText(words.slice(mid).join(" "), cx, cy + r * 0.56, r * 1.5);
  };
}

/** Builds the look into `kit.group` (base at y = 0, front facing +z). */
export function buildLook(look: Look, kit: LookKit) {
  const { box, hard, cyl, ball, ring, plane, mat, paint, bow } = kit;
  switch (look.id) {
    case "phillipsBox": {
      const { w, h, d } = look;
      box(mat(RED, "gloss"), [w, h, d], [0, h / 2, 0]);
      plane(paint(`phillips:${look.name}:${look.window}`, w, h, phillipsFront(look)), [w * 0.97, h * 0.97], [0, h / 2, d / 2 + 0.004]);
      if (look.ribbon) {
        const rib = mat(look.ribbon === "white" ? 0xfbf7f2 : 0xd4af6a, look.ribbon === "white" ? "satin" : "foil");
        hard(rib, [w * 1.01, 0.05, d * 1.04], [0, h * 0.72, 0]);
        hard(rib, [0.05, h * 1.01, d * 1.04], [w * 0.3, h / 2, 0]);
        bow(h * 0.72, d / 2 + 0.03, 0.8, rib);
      }
      return;
    }
    case "phillipsBar": {
      const dark = look.flavor !== "MILK";
      const choc = mat(dark ? CHOC.dark : CHOC.milk, "treat");
      hard(choc, [0.5, 1.18, 0.08], [0, 0.59, -0.01]);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) box(choc, [0.21, 0.18, 0.05], [-0.115 + c * 0.23, 0.98 + r * 0.2, 0.04]);
      const sleeve = paint(`phillipsbar:${look.flavor}`, 0.54, 0.78, (g, W, H, serif) => {
        g.fillStyle = "#fbf6ec"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#a3192b"; g.fillRect(W * 0.08, 0, W * 0.03, H); g.fillRect(W * 0.89, 0, W * 0.03, H);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = "#3b2f25"; g.font = `600 ${Math.round(W * 0.075)}px ${serif}`; g.fillText("PHILLIPS", W / 2, H * 0.12, W * 0.7);
        g.font = `${Math.round(W * 0.045)}px ${serif}`; g.fillText("CHOCOLATES", W / 2, H * 0.19, W * 0.7);
        g.fillStyle = "#a3192b"; g.font = `italic 600 ${Math.round(W * 0.14)}px ${serif}`; g.fillText("Classic", W / 2, H * 0.45, W * 0.72);
        g.font = `600 ${Math.round(look.flavor.length > 4 ? W * 0.11 : W * 0.15)}px ${serif}`; g.fillText(look.flavor, W / 2, H * 0.62, W * 0.72);
        g.fillStyle = "#735a39"; g.font = `${Math.round(W * 0.04)}px ${serif}`; g.fillText("HANDMADE SINCE 1925", W / 2, H * 0.86, W * 0.7);
      });
      hard(mat(0xfbf6ec), [0.54, 0.78, 0.12], [0, 0.39, 0]);
      plane(sleeve, [0.53, 0.77], [0, 0.39, 0.062]);
      return;
    }
    case "hashBar": {
      const label = paint("hash", 1.6, 0.42, (g, W, H, serif) => {
        g.fillStyle = "#f6eedf"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#c79a4e"; g.fillRect(0, H * 0.08, W, H * 0.05); g.fillRect(0, H * 0.87, W, H * 0.05);
        g.textAlign = "center"; g.textBaseline = "middle";
        for (const x of [0.25, 0.75]) {
          g.fillStyle = "#3b2f25"; g.font = `600 ${Math.round(H * 0.15)}px ${serif}`; g.fillText("PHILLIPS CHOCOLATES", W * x, H * 0.3, W * 0.42);
          g.fillStyle = "#a3192b"; g.font = `600 ${Math.round(H * 0.22)}px ${serif}`; g.fillText("DARK ROYAL HASH", W * x, H * 0.6, W * 0.44);
        }
      });
      cyl(label, [0.21, 0.78, 0.21], [0, 0.22, 0], [0, 0, Math.PI / 2]);
      const end = mat(CHOC.dark, "treat");
      cyl(end, [0.2, 0.16, 0.2], [-0.47, 0.22, 0], [0, 0, Math.PI / 2]);
      cyl(end, [0.2, 0.16, 0.2], [0.47, 0.22, 0], [0, 0, Math.PI / 2]);
      for (let k = 0; k < 4; k++) ball(mat(0xc9a06a, "treat"), [0.04, 0.03, 0.03], [(k % 2 ? 0.55 : -0.55), 0.16 + (k > 1 ? 0.12 : 0), 0.08]);
      return;
    }
    case "pouch": {
      const body = look.color === "gold" ? mat(0xc9a14f, "foil") : mat(look.color === "pink" ? 0xf2b2c2 : 0xf7f5f2, "gloss");
      box(body, [0.64, 1.0, 0.2], [0, 0.5, 0]);
      hard(body, [0.66, 0.08, 0.06], [0, 1.02, 0]);
      plane(paint(`pouch:${look.color}:${look.fill}:${look.name}`, 0.62, 0.96, pouchFront(look)), [0.62, 0.96], [0, 0.5, 0.104]);
      return;
    }
    case "clearBag": {
      kit.bag(mat(0xffffff, "cello"), [0.42, 0.98, 0.3], [0, 0, 0]);
      const choc = mat(CHOC.dark, "treat");
      const drizzle = mat(0xf2e6d4, "treat");
      for (let k = 0; k < 9; k++) {
        const a = k * 2.2;
        const p: V3 = [Math.cos(a) * 0.2, 0.14 + Math.floor(k / 3) * 0.2, Math.sin(a) * 0.1];
        if (look.fill === "pretzels") ring(k % 3 ? choc : drizzle, [0.1, 0.09, 0.1], p, [0.3 * k, 0.5, 0]);
        else ball(choc, [0.1, 0.085, 0.09], p);
      }
      cyl(mat(0xd4af6a, "foil"), [0.1, 0.05, 0.09], [0, 0.98, 0]);
      bow(1.0, 0.06, 0.8, mat(0xa3192b, "satin"));
      return;
    }
    case "bogFrogs": {
      box(mat(0xfaf8f4, "gloss"), [1.0, 0.72, 0.28], [0, 0.36, 0]);
      plane(paint("bogfrogs", 1.0, 0.72, (g, W, H, serif) => {
        g.fillStyle = "#fbfaf7"; g.fillRect(0, 0, W, H);
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#c21f2e";
        g.font = `italic 600 ${Math.round(H * 0.13)}px ${serif}`; g.fillText("Cranberry", W * 0.5, H * 0.17, W * 0.6);
        g.font = `800 ${Math.round(H * 0.2)}px ${serif}`; g.fillText("BOG FROGS", W * 0.5, H * 0.35, W * 0.8);
        g.fillStyle = "#6b4a3a"; g.font = `${Math.round(H * 0.05)}px ${serif}`; g.fillText("Cranberries & cashews in milk caramel and chocolate", W / 2, H * 0.48, W * 0.85);
        for (let k = 0; k < 5; k++) {
          const x = W * (0.2 + k * 0.15), y = H * 0.72;
          g.fillStyle = "#6e4129"; g.beginPath(); g.ellipse(x, y, W * 0.07, H * 0.1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#d1263a"; g.beginPath(); g.arc(x - W * 0.02, y - H * 0.03, W * 0.018, 0, Math.PI * 2); g.arc(x + W * 0.03, y + H * 0.02, W * 0.015, 0, Math.PI * 2); g.fill();
        }
      }), [0.98, 0.7], [0, 0.36, 0.142]);
      return;
    }
    case "dubaiBar": {
      box(mat(0xf3f6ee, "gloss"), [1.05, 0.48, 0.1], [0, 0.24, 0]);
      plane(paint("dubai", 1.05, 0.48, (g, W, H, serif) => {
        const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, "#fbfbf6"); grd.addColorStop(1, "#cfe8cf");
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
        g.fillStyle = "#2c2a26"; g.beginPath(); g.arc(W * 0.12, H * 0.28, H * 0.17, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#d4af6a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(H * 0.08)}px ${serif}`; g.fillText("OMNIYA", W * 0.12, H * 0.28);
        g.fillStyle = "#c79a2e"; g.font = `600 ${Math.round(H * 0.09)}px ${serif}`; g.fillText("DUBAI", W * 0.42, H * 0.2);
        g.fillStyle = "#3c6b2f"; g.font = `800 ${Math.round(H * 0.16)}px ${serif}`; g.fillText("PISTACHIO", W * 0.45, H * 0.38, W * 0.5);
        g.fillStyle = "#1f2a1a"; g.font = `800 ${Math.round(H * 0.26)}px ${serif}`; g.fillText("KUNAFA", W * 0.45, H * 0.64, W * 0.55);
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "#7fae55" : "#a7c97a"; g.beginPath(); g.ellipse(W * (0.8 + (k % 3) * 0.05), H * (0.35 + Math.floor(k / 3) * 0.3), W * 0.03, H * 0.08, 0.6, 0, Math.PI * 2); g.fill(); }
      }), [1.03, 0.46], [0, 0.24, 0.052]);
      return;
    }
    case "pbBark": {
      const bark = paint("pbbark", 0.86, 0.5, (g, W, H, serif) => {
        g.fillStyle = "#6b3f26"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "#d9a86a"; g.lineWidth = W * 0.012;
        for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(W * (k / 9), 0); g.bezierCurveTo(W * (k / 9 + 0.1), H * 0.3, W * (k / 9 - 0.05), H * 0.6, W * (k / 9 + 0.08), H); g.stroke(); }
        g.fillStyle = "#fbf3e6"; g.beginPath(); g.roundRect(W * 0.55, H * 0.08, W * 0.4, H * 0.28, 6); g.fill();
        g.fillStyle = "#a3192b"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(H * 0.09)}px ${serif}`;
        g.fillText("Peanut Butter", W * 0.75, H * 0.17, W * 0.36); g.fillText("Bark", W * 0.75, H * 0.28, W * 0.3);
      });
      hard(mat(0x6b3f26, "treat"), [0.86, 0.5, 0.08], [0, 0.25, 0]);
      plane(bark, [0.86, 0.5], [0, 0.25, 0.042]);
      box(mat(0xffffff, "cello"), [0.92, 0.56, 0.13], [0, 0.26, 0]);
      return;
    }
    case "fudge": {
      const color = { penuche: 0xc8894a, pistachio: 0xc6cc8a, chocolate: 0x4a2a1c, caramel: 0x8f5226 }[look.flavor];
      const f = mat(color, "treat");
      hard(mat(0xfbf6ee), [0.98, 0.025, 0.6], [0, 0.012, 0]);
      box(f, [0.42, 0.38, 0.42], [-0.22, 0.21, 0]);
      box(f, [0.42, 0.38, 0.42], [0.22, 0.21, 0.04]);
      box(f, [0.42, 0.38, 0.42], [0, 0.59, 0.02], [0, 0.35, 0]);
      if (look.flavor === "caramel" || look.flavor === "chocolate") hard(mat(0xd99a52, "treat"), [0.43, 0.06, 0.43], [-0.22, 0.2, 0]);
      const fleck = look.flavor === "pistachio" ? mat(0x6f9a3c, "treat") : look.flavor === "caramel" ? mat(0xffffff, "gloss") : null;
      if (fleck) for (let k = 0; k < 6; k++) hard(fleck, [0.05, 0.03, 0.05], [-0.12 + (k % 3) * 0.12, 0.79, -0.08 + Math.floor(k / 3) * 0.16], [0, k, 0.3]);
      return;
    }
    case "licorice": {
      const rope = paint("licorice", 0.3, 1.1, (g, W, H) => {
        g.fillStyle = "#121010"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "#3a3434"; g.lineWidth = W * 0.08;
        for (let y = -W; y < H + W; y += W * 0.35) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + W * 0.5); g.stroke(); }
      });
      for (let k = 0; k < 7; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r = k === 6 ? 0 : 0.11;
        cyl(rope, [0.05, 1.05, 0.05], [Math.cos(a) * r, 0.53, Math.sin(a) * r], [0.04 * Math.cos(a), 0, 0.04 * Math.sin(a)]);
      }
      cyl(mat(0xa3192b, "satin"), [0.18, 0.07, 0.18], [0, 0.55, 0]);
      bow(0.55, 0.18, 0.7, mat(0xa3192b, "satin"));
      return;
    }
    case "teddy": {
      const fur = mat(0xc08a52, "plush");
      const muzzle = mat(0xf0dcc0, "plush");
      const ink = mat(0x2a1d14, "gloss");
      ball(fur, [0.34, 0.4, 0.28], [0, 0.45, 0]);
      ball(muzzle, [0.2, 0.26, 0.05], [0, 0.42, 0.24]);
      ball(fur, [0.3, 0.28, 0.27], [0, 0.98, 0]);
      for (const s of [-1, 1]) {
        ball(fur, [0.11, 0.11, 0.08], [s * 0.23, 1.22, 0]);
        ball(muzzle, [0.06, 0.06, 0.04], [s * 0.23, 1.22, 0.05]);
        ball(fur, [0.13, 0.22, 0.13], [s * 0.33, 0.55, 0.05]);
        ball(fur, [0.15, 0.13, 0.19], [s * 0.2, 0.12, 0.12]);
        ball(ink, [0.03, 0.035, 0.025], [s * 0.1, 1.04, 0.25]);
      }
      ball(muzzle, [0.13, 0.1, 0.09], [0, 0.93, 0.24]);
      ball(ink, [0.04, 0.03, 0.025], [0, 0.97, 0.32]);
      bow(0.74, 0.26, 1.0, mat(0x7a4a2d, "satin"));
      return;
    }
    case "book": {
      hard(mat(0xfbf6ea), [0.72, 0.98, 0.13], [0, 0.49, -0.01]);
      hard(mat(0xd8322f, "gloss"), [0.04, 0.98, 0.15], [-0.36, 0.49, 0]);
      plane(paint("book", 0.72, 0.98, (g, W, H, serif) => {
        g.fillStyle = "#2fb3c4"; g.fillRect(0, 0, W, H);
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "#ffffff" : "#d8322f"; g.fillRect(W * 0.32, H * (0.38 + k * 0.05), W * 0.36, H * 0.05); }
        g.fillStyle = "#d8322f"; g.fillRect(W * 0.26, H * 0.68, W * 0.48, H * 0.04);
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffffff"; g.strokeStyle = "#1d1d1d"; g.lineWidth = 4;
        g.font = `800 ${Math.round(W * 0.15)}px ${serif}`; g.strokeText("Dr. Seuss", W / 2, H * 0.15, W * 0.85); g.fillText("Dr. Seuss", W / 2, H * 0.15, W * 0.85);
        g.fillStyle = "#fff3a8"; g.font = `600 ${Math.round(W * 0.07)}px ${serif}`; g.fillText("A Classic Story", W / 2, H * 0.27, W * 0.8);
      }), [0.7, 0.96], [0, 0.49, 0.068]);
      return;
    }
  }
}
