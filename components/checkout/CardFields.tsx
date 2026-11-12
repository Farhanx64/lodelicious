"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BrowserPaymentConfig } from "@/src/lib/payments/types";

import { usePreparer } from "./ActionForm";

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
  { type: "CARD_NUMBER", id: "card-number", text: "Card number", span: "col-span-2" },
  { type: "CARD_DATE", id: "card-date", text: "Expiry (MM/YY)", span: "" },
  { type: "CARD_CVV", id: "card-cvv", text: "Security code (CVV)", span: "" },
  { type: "CARD_POSTAL_CODE", id: "card-postal", text: "Billing ZIP code", span: "col-span-2" },
] as const;

const box = "min-h-11 w-full rounded-lg border border-ink-soft bg-paper px-3 py-2";
// Inside Clover's frames: our ink colour, and a system font (the frames can't load the site's).
// Clover's iframes default to 150 px tall; the field box below fixes them to one input line.
const frameStyles = {
  body: { margin: "0", padding: "0" },
  input: { fontSize: "16px", height: "46px", padding: "0 12px", margin: "0", color: "#3b2f25", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
};

/** Small card-brand marks beside "Card number". Decorative: Clover's field checks the card itself. */
function CardBrands() {
  const mark = "rounded border border-line bg-paper px-1.5 py-0.5 text-[0.625rem] font-bold leading-none tracking-wide";
  return (
    <span aria-hidden="true" className="flex gap-1">
      <span className={`${mark} text-[#1a1f71]`}>VISA</span>
      <span className={`${mark} text-[#c2410c]`}>MC</span>
      <span className={`${mark} text-[#006fcf]`}>AMEX</span>
      <span className={`${mark} text-ink`}>DISC</span>
    </span>
  );
}

function FieldLabel({ id, type, text }: { id?: string; type: string; text: string }) {
  return (
    <span className="mb-1 flex items-end justify-between gap-2">
      <span id={id} className="block text-sm font-semibold">
        {text}
      </span>
      {type === "CARD_NUMBER" && <CardBrands />}
    </span>
  );
}

/** "Secure payment by Clover" with the lock, under the card fields. */
function SecureLine() {
  return (
    <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="mt-0.5 size-4 shrink-0">
        <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12 6h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
      </svg>
      <span>
        <strong className="font-semibold text-ink">Secure payment by Clover.</strong> Your card goes straight to Clover; we never see or store the card
        number.
      </span>
    </p>
  );
}

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
    <fieldset className="mb-2">
      <legend className="mb-3 text-base font-semibold text-ink">Card details</legend>
      {config.kind === "clover" ? <CloverCard config={config} /> : <TestCard />}
    </fieldset>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

/** Same layout as the real form, so staging shows where the card goes. No card is asked for. */
function TestCard() {
  return (
    <>
      <p className="mb-3 rounded-lg border-l-4 border-gold bg-ivory p-3 text-sm">
        <strong>Test payment.</strong> On the live site, the card is typed into Clover&rsquo;s secure fields here. In this preview no card is needed and no
        money moves.
      </p>
      <Grid>
        {FIELDS.map((f) => (
          <div key={f.id} className={f.span || undefined}>
            <FieldLabel type={f.type} text={f.text} />
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
      {status === "failed" && (
        <p role="alert" className="mb-3 border border-error p-3 text-error">
          The card form couldn&rsquo;t load. Please check your connection and reload the page.
        </p>
      )}
      <Grid>
        {FIELDS.map((f) => (
          <div key={f.id} className={f.span || undefined}>
            <FieldLabel id={`${f.id}-label`} type={f.type} text={f.text} />
            <div id={f.id} role="group" aria-labelledby={`${f.id}-label`} aria-busy={status === "loading" || undefined} className="clover-field h-12 w-full overflow-hidden rounded-lg border border-ink-soft bg-paper p-0" />
            {errors[f.type] && <p className="mt-1 text-sm text-error">{errors[f.type]}</p>}
          </div>
        ))}
      </Grid>
      <SecureLine />
    </>
  );
}
