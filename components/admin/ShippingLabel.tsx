"use client";

import { useDocumentInfo, useFormFields } from "@payloadcms/ui";
import type { UIFieldClientComponent } from "payload";
import { useState, type CSSProperties } from "react";

import { formatCents } from "@/src/lib/money";

/**
 * "Shipping label" on a shipped order (D66): box size and weight (prefilled from checkout), Get rates,
 * pick a rate, Buy label. The server re-checks everything; this only shows what it says.
 */

type Rate = { id: string; carrier: string; service: string; amountCents: number; days: number | null };
type Label = { labelUrl: string; service: string; costCents: number; labelTrackingNumber: string; test: boolean };

const dimsFrom = (box: unknown) => {
  const m = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*in/i.exec(String(box ?? ""));
  return m ? [m[1], m[2], m[3]] : ["", "", ""];
};

const input: CSSProperties = { width: "6rem", padding: "0.4rem 0.5rem", border: "1px solid var(--theme-elevation-250)", borderRadius: 4, background: "var(--theme-input-bg)", color: "var(--theme-text)" };
const button: CSSProperties = { padding: "0.5rem 0.9rem", borderRadius: 4, border: "1px solid var(--theme-elevation-400)", background: "var(--theme-elevation-800)", color: "var(--theme-elevation-0)", cursor: "pointer", fontWeight: 600 };

export const ShippingLabel: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const box = useFormFields(([f]) => f["fulfillment.box"]?.value);
  const weight = useFormFields(([f]) => f["fulfillment.weightLbs"]?.value);
  const savedUrl = useFormFields(([f]) => f["shippingLabel.labelUrl"]?.value) as string | undefined;
  const savedTest = useFormFields(([f]) => f["shippingLabel.test"]?.value) as boolean | undefined;

  const [l0, w0, h0] = dimsFrom(box);
  const [dims, setDims] = useState({ lengthIn: l0, widthIn: w0, heightIn: h0, weightLbs: typeof weight === "number" ? String(weight) : "" });
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [test, setTest] = useState(false);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [label, setLabel] = useState<Label | null>(null);

  if (!id) return null;

  const post = async (path: string, payload: unknown) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${id}/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `Error ${res.status}`);
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const getRates = async () => {
    const body = await post("shipping-rates", dims);
    if (!body) return;
    setRates(body.rates as Rate[]);
    setTest(body.test === true);
    setChosen("");
  };

  const buy = async () => {
    const rate = rates?.find((r) => r.id === chosen);
    if (!rate) return;
    if (!test && !window.confirm(`Buy ${rate.carrier} ${rate.service} for ${formatCents(rate.amountCents)}? Lody's Shippo account is charged, and the customer is emailed the tracking number.`)) return;
    const body = await post("buy-label", { rateId: chosen });
    if (!body) return;
    setLabel(body.label as Label);
    setRates(null);
  };

  const shown = label ?? (savedUrl ? { labelUrl: savedUrl, test: !!savedTest } : null);

  return (
    <div className="field-type" style={{ marginBottom: "var(--spacing-field, 1.5rem)", padding: "1rem", border: "1px solid var(--theme-elevation-150)", borderRadius: 4 }}>
      <h4 style={{ margin: "0 0 0.5rem" }}>Shipping label (Shippo)</h4>

      {shown && (
        <p style={{ margin: "0 0 0.75rem" }}>
          <a href={shown.labelUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
            Print label (PDF, 4×6)
          </a>
          {shown.test && <strong style={{ marginLeft: "0.5rem", color: "#b45309" }}>TEST label: not real postage, don&rsquo;t mail it.</strong>}
          {label && !label.test && <span style={{ marginLeft: "0.5rem" }}>Order saved as Shipped; the customer was emailed. Reload to see it.</span>}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "end" }}>
        {(
          [
            ["lengthIn", "Length (in)"],
            ["widthIn", "Width (in)"],
            ["heightIn", "Height (in)"],
            ["weightLbs", "Packed weight (lb)"],
          ] as const
        ).map(([k, text]) => (
          <label key={k} style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            {text}
            <input style={input} inputMode="decimal" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} />
          </label>
        ))}
        <button type="button" style={button} disabled={busy} onClick={getRates}>
          {busy && !rates ? "Getting rates…" : "Get rates"}
        </button>
      </div>
      <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", opacity: 0.75 }}>Filled in from the box and weight checkout picked. Add the box and packing to the weight.</p>

      {rates && (
        <fieldset style={{ marginTop: "1rem", border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{test ? "Rates (TEST: sample label, nothing is charged)" : "Rates"}</legend>
          {rates.map((r) => (
            <label key={r.id} style={{ display: "flex", gap: "0.5rem", padding: "0.35rem 0", alignItems: "center" }}>
              <input type="radio" name="shippo-rate" value={r.id} checked={chosen === r.id} onChange={() => setChosen(r.id)} />
              <span style={{ minWidth: "4.5rem", fontWeight: 600 }}>{formatCents(r.amountCents)}</span>
              <span>
                {r.carrier} {r.service}
                {r.days ? ` · about ${r.days} day${r.days === 1 ? "" : "s"}` : ""}
              </span>
            </label>
          ))}
          <button type="button" style={{ ...button, marginTop: "0.5rem" }} disabled={busy || !chosen} onClick={buy}>
            {busy ? "Buying…" : test ? "Buy TEST label" : "Buy label"}
          </button>
        </fieldset>
      )}

      {error && (
        <p role="alert" style={{ marginTop: "0.75rem", color: "var(--theme-error-500)" }}>
          {error}
        </p>
      )}
    </div>
  );
};
