"use client";

import type { DefaultCellComponentProps } from "payload";

/** Marks test-payment orders in admin lists so they are never packed or counted as sales (A14). */
export function TestOrderCell({ cellData }: DefaultCellComponentProps) {
  if (cellData !== true) return <span aria-label="Real order">Real</span>;
  return (
    <strong style={{ background: "#b45309", color: "#fff", padding: "0.1rem 0.45rem", borderRadius: "0.25rem", letterSpacing: "0.04em" }}>TEST</strong>
  );
}
