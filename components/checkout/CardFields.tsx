"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BrowserPaymentConfig } from "@/src/lib/payments/types";

import { usePreparer } from "./ActionForm";
import { label } from "./styles";

/** The parts of Clover's iframe SDK this page uses (D54). The card is typed into Clover's frames, never ours. */
type CloverElement = { mount(selector: string): void; addEventListener(event: "change" | "blur", fn: (e: Record<string, { error?: string; touched?: boolean }>) => void): void };
type CloverInstance = {
  elements(): { create(type: string, styles?: Record<string, unknown>): CloverElement };
  createToken(): Promise<{ token?: string; errors?: Record<string, string> }>;
};
declare global {
  interface Window {
    Clover?: new (key: string, options?: { merchantId?: string; locale?: string }) => CloverInstance;
  }
}

const FIELDS = [
  { type: "CARD_NUMBER", id: "card-number", text: "Card number" },
  { type: "CARD_DATE", id: "card-date", text: "Expiry (MM/YY)" },
  { type: "CARD_CVV", id: "card-cvv", text: "Security code (CVV)" },
  { type: "CARD_POSTAL_CODE", id: "card-postal", text: "Billing ZIP code" },
] as const;

const box = "min-h-11 w-full border border-ink-soft bg-paper px-3 py-2";
const frameStyles = { input: { fontSize: "16px", color: "#2b2422" } };

function loadSdk(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Clover) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[data-clover-sdk]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: url, async: true });
    script.dataset.cloverSdk = "1";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("sdk")));
    if (!existing) document.head.appendChild(script);
  });
}

/** The card form: Clover's hosted iframes, or a labelled placeholder with the test provider. */
export function CardFields({ config }: { config: BrowserPaymentConfig }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-3 font-display text-xl text-gold-text">Card payment</legend>
      {config.kind === "clover" ? <CloverCard config={config} /> : <TestCard />}
    </fieldset>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">{children}</div>;
}

/** Same layout as the real form, so staging shows where the card goes. No card is asked for. */
function TestCard() {
  return (
    <>
      <p className="mb-3 border-l-4 border-gold bg-paper p-3 text-sm">
        <strong>Test payment.</strong> On the live site, the card is typed into Clover&rsquo;s secure fields here. In this preview no card is needed and no
        money moves.
      </p>
      <Grid>
        {FIELDS.map((f) => (
          <div key={f.id} className={f.type === "CARD_NUMBER" ? "sm:col-span-2" : undefined}>
            <span className={label}>{f.text}</span>
            <div aria-hidden="true" className={`${box} text-ink-soft`}>
              {f.type === "CARD_NUMBER" ? "4242 4242 4242 4242 (not needed)" : "—"}
            </div>
          </div>
        ))}
      </Grid>
    </>
  );
}

function CloverCard({ config }: { config: Extract<BrowserPaymentConfig, { kind: "clover" }> }) {
  const clover = useRef<CloverInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    loadSdk(config.sdkUrl)
      .then(() => {
        if (cancelled || !window.Clover) return;
        const instance = new window.Clover(config.publicKey, config.merchantId ? { merchantId: config.merchantId } : undefined);
        const elements = instance.elements();
        for (const f of FIELDS) {
          const el = elements.create(f.type, frameStyles);
          el.mount(`#${f.id}`);
          el.addEventListener("change", (event) => {
            const e = event[f.type];
            setErrors((prev) => ({ ...prev, [f.type]: e?.touched && e.error ? e.error : "" }));
          });
        }
        clover.current = instance;
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("failed"));
    return () => {
      cancelled = true;
    };
  }, [config.sdkUrl, config.publicKey, config.merchantId]);

  const prepare = useCallback(async (form: FormData) => {
    if (!clover.current) return "The card form hasn't loaded. Please reload the page and try again.";
    const result = await clover.current.createToken();
    if (result.token) {
      form.set("cardToken", result.token);
      return null;
    }
    const first = Object.values(result.errors ?? {}).find(Boolean);
    return first ? `Please check your card: ${first}` : "Please check your card details.";
  }, []);
  usePreparer(prepare);

  return (
    <>
      <p className="mb-3 text-sm">Your card is entered into Clover&rsquo;s secure fields and goes straight to Clover. We never see or store the card number.</p>
      {status === "failed" && (
        <p role="alert" className="mb-3 border border-error p-3 text-error">
          The card form couldn&rsquo;t load. Please check your connection and reload the page.
        </p>
      )}
      <Grid>
        {FIELDS.map((f) => (
          <div key={f.id} className={f.type === "CARD_NUMBER" ? "sm:col-span-2" : undefined}>
            <span id={`${f.id}-label`} className={label}>
              {f.text}
            </span>
            <div id={f.id} role="group" aria-labelledby={`${f.id}-label`} aria-busy={status === "loading" || undefined} className={`${box} p-0`} />
            {errors[f.type] && <p className="mt-1 text-sm text-error">{errors[f.type]}</p>}
          </div>
        ))}
      </Grid>
    </>
  );
}
