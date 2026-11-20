"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { DashboardStats } from "@/src/lib/dashboard/stats";

const BRAND = { cream: 0xf7f2ee, blush: 0xefd5ce, coastal: 0xd58f9c, deep: 0x9c4459, gold: 0xb99870, linen: 0xeadccf };
const STATUS_COLORS = [0xd58f9c, 0xb99870, 0x9c4459, 0xeadccf, 0x665a4e];

const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Daily sales as a row of 3D bars (gold for the busiest day) beside a ring of order statuses, in
 * the shop's colours. Drag to turn, hover a bar for its day. Static when the viewer prefers less motion.
 */
export function Dashboard3D({ stats }: { stats: DashboardStats }) {
  const mount = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BRAND.cream);
    scene.fog = new THREE.Fog(BRAND.cream, 30, 70);
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, BRAND.linen, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(10, 20, 12);
    sun.castShadow = true;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top = 25;
    scene.add(sun);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: BRAND.blush, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);

    // Sales bars
    const max = Math.max(1, ...stats.days.map((d) => d.revenueCents));
    const bars: THREE.Mesh[] = [];
    const spacing = 0.75;
    const offset = ((stats.days.length - 1) * spacing) / 2;
    stats.days.forEach((d, i) => {
      const h = 0.15 + (d.revenueCents / max) * 9;
      const best = d.revenueCents === max && d.revenueCents > 0;
      const mat = new THREE.MeshStandardMaterial({ color: best ? BRAND.gold : BRAND.coastal, roughness: 0.35, metalness: best ? 0.5 : 0.1 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), mat);
      bar.position.set(i * spacing - offset, reduce ? h / 2 : 0, -2);
      bar.scale.y = reduce ? 1 : 0.001;
      bar.castShadow = true;
      bar.userData = { label: `${d.label}: ${money(d.revenueCents)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`, h };
      group.add(bar);
      bars.push(bar);
    });

    // Status ring
    const total = stats.statuses.reduce((n, s) => n + s.count, 0);
    let start = 0;
    stats.statuses.forEach((s, i) => {
      const len = total ? (s.count / total) * Math.PI * 2 : (Math.PI * 2) / stats.statuses.length;
      if (total && !s.count) return;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.55, 24, 64, Math.max(0.02, len - 0.04)),
        new THREE.MeshStandardMaterial({ color: STATUS_COLORS[i % STATUS_COLORS.length], roughness: 0.4, transparent: !total, opacity: total ? 1 : 0.35 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = start;
      ring.position.set(0, 0.6, 5.5);
      ring.castShadow = true;
      ring.userData = { label: `${s.label}: ${s.count}` };
      group.add(ring);
      start += len;
    });

    // Orbit by drag
    let yaw = -0.35;
    let pitch = 0.42;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const place = () => {
      const r = 26;
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
      camera.lookAt(0, 2, 1);
    };
    place();

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (dragging) {
        yaw -= (e.clientX - lastX) * 0.006;
        pitch = Math.min(1.2, Math.max(0.1, pitch + (e.clientY - lastY) * 0.004));
        lastX = e.clientX;
        lastY = e.clientY;
        place();
      }
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(group.children)[0];
      setHover(hit ? String(hit.object.userData.label) : null);
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => (dragging = false);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      bars.forEach((b, i) => {
        const p = Math.min(1, Math.max(0, (t - i * 0.03) / 0.8));
        const e = 1 - Math.pow(1 - p, 3);
        b.scale.y = Math.max(0.001, e);
        b.position.y = (b.userData.h * e) / 2;
      });
      if (!dragging) {
        yaw += 0.0008;
        place();
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    if (reduce) renderer.render(scene, camera);
    else tick();

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [stats]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-paper shadow-sm">
      <div className="pointer-events-none absolute top-4 left-5 z-10">
        <h2 className="font-display text-2xl">Last 30 days</h2>
        <p className="text-sm text-ink-soft">Bars: daily sales (gold = best day). Ring: orders by status. Drag to turn.</p>
      </div>
      <div ref={mount} className="h-[min(70vh,560px)] w-full cursor-grab touch-none active:cursor-grabbing" aria-hidden="true" />
      <p className="absolute right-5 bottom-4 min-h-6 rounded-full bg-paper/90 px-3 py-1 text-sm" aria-live="polite">
        {hover ?? "Hover a bar for that day"}
      </p>
    </section>
  );
}
