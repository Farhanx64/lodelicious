"use client";

import { useFormFields } from "@payloadcms/ui";
import type { UIFieldClientComponent } from "payload";
import type { CSSProperties, ReactNode } from "react";

import { formatCents } from "@/src/lib/money";

/**
 * Read-only summaries at the top of an order or a basket reservation: what was bought and what it
 * cost, in dollars. They read the stored snapshot (the `lines` or `basket` JSON and the totals), which
 * stays on the "Record data" tab for anyone who needs every detail.
 */

type Row = { label: string; detail?: string | null; quantity?: number; unitCents?: number; totalCents?: number };
type Total = { label: string; cents: unknown; strong?: boolean; note?: string };

const money = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) ? formatCents(value) : "—");
const parsed = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : []);
const num = (value: unknown) => (typeof value === "number" ? value : undefined);
const str = (value: unknown) => (typeof value === "string" ? value : undefined);

const cell: CSSProperties = { padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--theme-elevation-100)", textAlign: "left", verticalAlign: "top" };
const right: CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap" };

function Summary({ title, rows, totals, empty }: { title: string; rows: Row[]; totals: Total[]; empty: ReactNode }) {
  return (
    <div className="field-type" style={{ marginBottom: "var(--spacing-field, 1.5rem)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid var(--theme-elevation-150)", borderRadius: "var(--style-radius-s, 4px)" }}>
        <caption style={{ textAlign: "left", fontWeight: 600, padding: "0 0 0.5rem" }}>{title}</caption>
        <thead>
          <tr style={{ background: "var(--theme-elevation-50)" }}>
            <th scope="col" style={cell}>
              Item
            </th>
            <th scope="col" style={right}>
              Qty
            </th>
            <th scope="col" style={right}>
              Each
            </th>
            <th scope="col" style={right}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={cell}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                <td style={cell}>
                  {row.label}
                  {row.detail ? <span style={{ color: "var(--theme-elevation-600)" }}> · {row.detail}</span> : null}
                </td>
                <td style={right}>{row.quantity ?? ""}</td>
                <td style={right}>{row.unitCents === undefined ? "" : money(row.unitCents)}</td>
                <td style={right}>{money(row.totalCents)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          {totals.map((t) => (
            <tr key={t.label}>
              <th scope="row" colSpan={3} style={{ ...right, fontWeight: t.strong ? 700 : 400 }}>
                {t.label}
                {t.note ? <span style={{ fontWeight: 400, color: "var(--theme-elevation-600)" }}> ({t.note})</span> : null}
              </th>
              <td style={{ ...right, fontWeight: t.strong ? 700 : 400 }}>{money(t.cents)}</td>
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

/** Orders: each line as bought, then subtotal, tax and total. */
export const OrderSummary: UIFieldClientComponent = () => {
  const lines = useFormFields(([fields]) => fields.lines?.value);
  const subtotal = useFormFields(([fields]) => fields["totals.subtotalCents"]?.value);
  const tax = useFormFields(([fields]) => fields["totals.taxCents"]?.value);
  const total = useFormFields(([fields]) => fields["totals.totalCents"]?.value);
  const taxApproved = useFormFields(([fields]) => fields["totals.taxApproved"]?.value);

  const rows: Row[] = list(parsed(lines)).map((line) => ({
    label: str(line.title) ?? "Item",
    detail: str(line.option),
    quantity: num(line.quantity),
    unitCents: num(line.unitPriceCents),
    totalCents: num(line.lineTotalCents),
  }));
  const totals: Total[] = [
    { label: "Subtotal", cents: subtotal },
    { label: "Tax", cents: tax, note: taxApproved === false ? "estimate: the tax rate was not approved" : undefined },
    { label: "Total", cents: total, strong: true },
  ];
  return <Summary title="Items" rows={rows} totals={totals} empty="No items recorded." />;
};

/**
 * Basket reservations: the basket's contents and fee, then tax, total and what was charged when it was
 * reserved. What has been paid since and the balance are the editable fields right below it.
 */
export const ReservationSummary: UIFieldClientComponent = () => {
  const basket = useFormFields(([fields]) => fields.basket?.value);
  const total = useFormFields(([fields]) => fields.totalCents?.value);
  const tax = useFormFields(([fields]) => fields.taxCents?.value);
  const deposit = useFormFields(([fields]) => fields.depositCents?.value);
  const taxApproved = useFormFields(([fields]) => fields.taxApproved?.value);

  const stored = parsed(basket);
  const snapshot = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const rows: Row[] = list(snapshot.components).map((c) => {
    const quantity = num(c.quantity);
    const unitCents = num(c.unitPriceCents);
    return { label: str(c.name) ?? "Item", quantity, unitCents, totalCents: quantity !== undefined && unitCents !== undefined ? quantity * unitCents : undefined };
  });
  const packaging = num(snapshot.packagingCents);
  if (packaging !== undefined && packaging > 0) rows.push({ label: "Basket & packaging", totalCents: packaging });

  const totals: Total[] = [
    { label: "Tax", cents: tax, note: taxApproved === false ? "estimate: the tax rate was not approved" : undefined },
    { label: "Basket total", cents: total, strong: true },
    { label: "Charged when reserved", cents: deposit },
  ];
  return <Summary title={str(snapshot.title) ?? "Basket"} rows={rows} totals={totals} empty="No contents recorded." />;
};
