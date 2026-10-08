"use client";

import { useRef } from "react";

/**
 * The phone menu's <details>. The header persists across client navigations, so a native
 * disclosure would stay open over the new page; close it when a menu link is followed and on
 * Escape (audit A17). Without JavaScript it is still a plain, working <details>.
 */
export function MenuDisclosure({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("nav a")) ref.current?.removeAttribute("open");
      }}
      onKeyDown={(e) => {
        const menu = ref.current;
        if (e.key !== "Escape" || !menu?.open) return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }}
    >
      {children}
    </details>
  );
}
