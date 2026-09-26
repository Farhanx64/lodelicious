"use client";

import type { DefaultCellComponentProps } from "payload";

/** Shows integer cents as dollars in admin list views (1495 → $14.95). */
export function CentsCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== "number") return <span>—</span>;
  const abs = Math.abs(cellData);
  return (
    <span>
      {cellData < 0 ? "-" : ""}${Math.trunc(abs / 100).toLocaleString("en-US")}.{String(abs % 100).padStart(2, "0")}
    </span>
  );
}
