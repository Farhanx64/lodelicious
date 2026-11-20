"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { createProductModels, type ModelProduct } from "./product-models";

export type PreviewItem = ModelProduct & { quantity: number };

const SIZE_SCALE: Record<string, number> = { small: 0.8, medium: 0.92, large: 1.05, extra_large: 1.2 };

/** A woven-look band texture drawn on a canvas: no image files to load. */
function wickerTexture(): THREE.CanvasTexture {
  // Over-under weave: horizontal reeds passing in front of and behind upright stakes.
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6f5233";
  g.fillRect(0, 0, 512, 256);
  const row = 16;
  const stake = 32;
  for (let y = 0; y < 256; y += row) {
    const odd = (y / row) % 2;
    for (let x = -stake; x < 512 + stake; x += stake) {
      const sx = x + (odd ? stake / 2 : 0);
      const grad = g.createLinearGradient(0, y + 1, 0, y + row - 1);
      grad.addColorStop(0, "#c9a477");
      grad.addColorStop(0.45, "#e4c9a0");
      grad.addColorStop(1, "#9c7a52");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(sx + stake / 2, y + row / 2, stake / 2 + 3, row / 2 - 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Fine grain on the reeds
  g.globalAlpha = 0.12;
  g.strokeStyle = "#5a4128";
  for (let y = 2; y < 256; y += 3) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y + ((y * 7) % 3) - 1);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1.6);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A live 3D picture of the basket being built: the basket grows with the chosen size and each item
 * drops in as a locally modelled product. Decorative only; the list beside it is the record.
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Soft studio reflections so foil, satin and cellophane read as what they are.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 4.6, 7.4);
    camera.lookAt(0, 1.9, 0);
    scene.add(new THREE.HemisphereLight(0xfff6f0, 0xefd5ce, 0.6));
    const sun = new THREE.DirectionalLight(0xfff1e6, 1.4);
    sun.position.set(3, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 4;
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0xf8e6e8, 0.6);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.1 }));
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
    // Satin bow with tails on the handle, the shop's signature.
    const bow = new THREE.Group();
    const ribbon = new THREE.MeshPhysicalMaterial({ color: 0x9c4459, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.3 });
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 28), ribbon);
      loop.position.x = s * 0.32;
      loop.rotation.z = s * 0.25;
      loop.scale.set(1, 0.62, 0.8);
      bow.add(loop);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.03), ribbon);
      tail.position.set(s * 0.18, -0.38, 0.02);
      tail.rotation.z = s * 0.35;
      bow.add(tail);
    });
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), ribbon));
    bow.position.set(0, 3.95, 0);
    bow.traverse((o) => (o.castShadow = true));
    basket.add(bow);
    // Blush tissue, then a crinkle-paper bed the treats nestle into.
    const tissue = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.85, 0.4, 40), new THREE.MeshStandardMaterial({ color: 0xf8e6e8, roughness: 1 }));
    tissue.position.y = 1.2;
    basket.add(tissue);
    // A scalloped collar of puffed tissue paper just inside the rim, blush and ivory.
    const PETALS = 28;
    const petalGeo = new THREE.SphereGeometry(0.34, 16, 10);
    petalGeo.scale(1, 0.42, 0.62);
    const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), PETALS);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < PETALS; i++) {
      const a = (i / PETALS) * Math.PI * 2 + (i % 2) * 0.08;
      const r = 2.1 - (i % 2) * 0.05;
      dummy.position.set(Math.cos(a) * r, 1.62 + (i % 3) * 0.03, Math.sin(a) * r);
      dummy.rotation.set(0, -a + Math.PI / 2, 0);
      dummy.rotateX(-0.35);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, new THREE.Color(i % 2 ? 0xf7f0ea : 0xf3d3d0));
    }
    petals.castShadow = true;
    petals.receiveShadow = true;
    basket.add(petals);

    const models = createProductModels();
    const placed = new Map<string, THREE.Group>();
    let targetScale = SIZE_SCALE[size] ?? 1;

    const slot = (i: number, count: number) => {
      // Wider baskets of contents use four compact columns; keep corners inside the rim.
      const columns = count > 12 ? 4 : 3;
      const row = Math.floor((i % (columns * 4)) / columns);
      // Rows step down toward the viewer and sink into the shred, like a hand-packed basket.
      const jitter = ((i * 37) % 7) / 7 - 0.5;
      return new THREE.Vector3(
        ((i % columns) - (columns - 1) / 2) * (columns === 4 ? 0.92 : 1.02) + jitter * 0.12 + (row % 2) * 0.22,
        1.36 - row * 0.05 + Math.floor(i / (columns * 4)) * 1.3,
        -1.05 + row * 0.72,
      );
    };

    const setItems = (list: PreviewItem[]) => {
      const units = list.flatMap((it) => Array.from({ length: Math.min(it.quantity, 4) }, (_, q) => ({ key: `${it.id}#${q}`, it })));
      const keep = new Set(units.map((u) => u.key));
      for (const [key, mesh] of placed) {
        if (!keep.has(key)) {
          basket.remove(mesh);
          placed.delete(key);
        }
      }
      units.forEach(({ key, it }, i) => {
        let mesh = placed.get(key);
        if (!mesh) {
          mesh = models.create(it);
          mesh.position.copy(slot(i, units.length)).add(new THREE.Vector3(0, reduce ? 0 : 3, 0));
          basket.add(mesh);
          placed.set(key, mesh);
        }
      });
      // Tall bars and plush gifts at the back, short trays at the front.
      const arranged = [...placed.values()].sort((a, b) => b.userData.height - a.userData.height);
      arranged.forEach((mesh, i) => {
        const p = slot(i, units.length);
        mesh.scale.setScalar(units.length > 12 ? 1.08 : 1.3);
        mesh.userData.target = p;
        mesh.rotation.y = p.x * 0.18 + (((i * 53) % 9) / 9 - 0.5) * 0.25;
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
      // Product resources are shared and owned by their pool, including removed items.
      placed.forEach((model) => basket.remove(model));
      models.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          [o.material].flat().forEach((m: THREE.Material) => materials.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      wicker.dispose();
      envMap.dispose();
      pmrem.dispose();
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

  return <div ref={mount} aria-hidden="true" className="h-[min(62vh,28rem)] w-full cursor-grab touch-pan-y rounded-lg bg-gradient-to-b from-coastal-pale to-cream active:cursor-grabbing" />;
}
