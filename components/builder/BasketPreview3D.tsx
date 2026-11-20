"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type PreviewItem = { id: string; title: string; quantity: number; imageUrl: string | null; premium: boolean };

const SIZE_SCALE: Record<string, number> = { small: 0.8, medium: 0.92, large: 1.05, extra_large: 1.2 };
const FILL = [0xd58f9c, 0xb99870, 0xefd5ce, 0x9c4459, 0xeadccf];

/** A woven-look band texture drawn on a canvas: no image files to load. */
function wickerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b99870";
  g.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 256; x += 32) {
      const shift = (y / 16) % 2 ? 16 : 0;
      const grad = g.createLinearGradient(x + shift, y, x + shift + 28, y + 14);
      grad.addColorStop(0, "#d2b58e");
      grad.addColorStop(1, "#8e6f4c");
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x + shift + 2, y + 2, 28, 12, 6);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A live 3D picture of the basket being built: the basket grows with the chosen size and each item
 * drops in as a box wearing its product photo. Decorative only; the list beside it is the record.
 */
export function BasketPreview3D({ items, size }: { items: PreviewItem[]; size: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const api = useRef<{ setItems: (items: PreviewItem[]) => void; setSize: (s: string) => void } | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the builder works without the picture.
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 5.2, 9);
    camera.lookAt(0, 1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xeadccf, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    scene.add(sun);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const basket = new THREE.Group();
    scene.add(basket);
    const wicker = wickerTexture();
    const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(1.9, 0), new THREE.Vector2(2.3, 1.5), new THREE.Vector2(2.45, 1.65), new THREE.Vector2(2.35, 1.65)];
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), new THREE.MeshStandardMaterial({ map: wicker, roughness: 0.9, side: THREE.DoubleSide }));
    body.castShadow = true;
    basket.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.09, 12, 64), new THREE.MeshStandardMaterial({ color: 0x8e6f4c, roughness: 0.8 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.65;
    basket.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 10, 48, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8e6f4c, roughness: 0.8 }));
    handle.position.y = 1.65;
    basket.add(handle);
    const bow = new THREE.Group();
    const ribbon = new THREE.MeshStandardMaterial({ color: 0x9c4459, roughness: 0.5 });
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 24), ribbon);
      loop.position.x = s * 0.3;
      loop.scale.set(1, 0.6, 1);
      bow.add(loop);
    });
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), ribbon));
    bow.position.set(0, 3.95, 0);
    basket.add(bow);
    // Tissue paper the items sit in
    const tissue = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 1.85, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0xf8e6e8, roughness: 1 }));
    tissue.position.y = 1.2;
    basket.add(tissue);

    const loader = new THREE.TextureLoader();
    const textures = new Map<string, THREE.Texture>();
    const placed = new Map<string, THREE.Mesh>();
    let targetScale = SIZE_SCALE[size] ?? 1;

    const slot = (i: number) => {
      const ring = i < 6 ? 0 : 1;
      const k = ring ? i - 6 : i;
      const n = ring ? 10 : 6;
      const r = ring ? 1.5 : 0.75;
      const a = (k / n) * Math.PI * 2 + ring * 0.3;
      return new THREE.Vector3(Math.cos(a) * r * (i === 0 ? 0 : 1), 1.75 + (ring ? 0 : 0.35) + Math.floor(i / 16) * 0.6, Math.sin(a) * r * (i === 0 ? 0 : 1));
    };

    const setItems = (list: PreviewItem[]) => {
      const units = list.flatMap((it) => Array.from({ length: Math.min(it.quantity, 4) }, (_, q) => ({ key: `${it.id}#${q}`, it })));
      const keep = new Set(units.map((u) => u.key));
      for (const [key, mesh] of placed) {
        if (!keep.has(key)) {
          basket.remove(mesh);
          (mesh.material as THREE.Material[]).forEach((m) => m.dispose());
          mesh.geometry.dispose();
          placed.delete(key);
        }
      }
      units.forEach(({ key, it }, i) => {
        let mesh = placed.get(key);
        if (!mesh) {
          const color = FILL[[...it.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % FILL.length];
          const side = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: it.premium ? 0.35 : 0 });
          const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
          if (it.imageUrl) {
            let tex = textures.get(it.imageUrl);
            if (!tex) {
              tex = loader.load(it.imageUrl);
              tex.colorSpace = THREE.SRGBColorSpace;
              textures.set(it.imageUrl, tex);
            }
            front.map = tex;
          } else front.color.set(color);
          const h = it.premium ? 1.05 : 0.85;
          mesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 0.35), [side, side, side, side, front, front]);
          mesh.castShadow = true;
          mesh.position.copy(slot(i)).add(new THREE.Vector3(0, reduce ? 0 : 3, 0));
          mesh.userData.drop = !reduce;
          basket.add(mesh);
          placed.set(key, mesh);
        }
        const p = slot(i);
        mesh.userData.target = p;
        mesh.rotation.y = Math.atan2(p.x, p.z) || 0;
        mesh.rotation.x = -0.15;
        if (reduce) mesh.position.copy(p);
      });
    };
    const setSize = (s: string) => (targetScale = SIZE_SCALE[s] ?? 1);
    api.current = { setItems, setSize };
    setItems(items);

    let yaw = 0;
    let drag = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      drag = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      yaw += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = () => (drag = false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const resize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let frame = 0;
    const tick = () => {
      if (!drag && !reduce) yaw += 0.004;
      basket.rotation.y = yaw;
      const s = basket.scale.x + (targetScale - basket.scale.x) * (reduce ? 1 : 0.1);
      basket.scale.setScalar(s);
      for (const m of placed.values()) {
        const t = m.userData.target as THREE.Vector3 | undefined;
        if (t) m.position.lerp(t, reduce ? 1 : 0.12);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          [o.material].flat().forEach((m: THREE.Material) => m.dispose());
        }
      });
      textures.forEach((t) => t.dispose());
      wicker.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
    // The scene is built once; item and size changes go through `api` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.setItems(items);
  }, [items]);
  useEffect(() => {
    api.current?.setSize(size);
  }, [size]);

  return <div ref={mount} aria-hidden="true" className="mb-4 h-56 w-full cursor-grab touch-pan-y rounded-lg bg-gradient-to-b from-coastal-pale to-cream active:cursor-grabbing" />;
}
