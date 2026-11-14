"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { amountFor, type ApplePayAmount } from "@/src/lib/payments/apple-pay";
import {
  GOOGLE_PAY_SCRIPT,
  googlePayAllowed,
  googlePayReady,
  mountGooglePay,
  type CloverGooglePay,
  type CloverWalletElements,
} from "@/src/lib/payments/google-pay";

import { useWalletSubmit } from "./ActionForm";

const MOUNT_ID = "google-pay-button";
const noSubscribe = () => () => {};

declare global {
  interface Window {
    google?: Parameters<typeof googlePayReady>[0];
  }
}

/** The current value of a radio group (inside the form or joined to it with `form="…"`). */
function chosen(field: string): string | null {
  return document.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(field)}"]:checked`)?.value ?? null;
}

let googleScript: Promise<void> | null = null;
/** Google's pay.js, once per page, to ask `isReadyToPay` the way Clover's frame does. */
function loadGoogleScript(): Promise<void> {
  googleScript ??= new Promise<void>((resolve, reject) => {
    if (window.google?.payments?.api?.PaymentsClient) return resolve();
    const script = Object.assign(document.createElement("script"), { src: GOOGLE_PAY_SCRIPT, async: true });
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      googleScript = null;
      reject(new Error("pay.js"));
    });
    document.head.appendChild(script);
  });
  return googleScript;
}

/**
 * Clover's Google Pay button (D63), above the card fields, on the same Clover elements as the card.
 * Takes no space and shows no "or pay by card" line until Google says this browser can pay, and
 * goes away again if Clover's frame removes the button. Never shown where Apple Pay is. Paying
 * submits the same form with Google Pay's token in place of the card's.
 */
export function GooglePayButton({
  clover,
  elements,
  amount,
  applePayOffered,
  environment,
}: {
  clover: CloverGooglePay;
  elements: CloverWalletElements;
  amount: ApplePayAmount;
  /** Apple Pay is switched on for this page: a device with Apple Pay gets that instead. */
  applePayOffered: boolean;
  environment: "TEST" | "PRODUCTION";
}) {
  const allowed = useSyncExternalStore(
    noSubscribe,
    () => googlePayAllowed(window, applePayOffered),
    () => false,
  );
  const wallet = useWalletSubmit();
  const walletRef = useRef(wallet);
  const amountRef = useRef(amount);
  const control = useRef<ReturnType<typeof mountGooglePay> | null>(null);
  const [ready, setReady] = useState(false);
  const [removed, setRemoved] = useState(false);
  useEffect(() => {
    walletRef.current = wallet;
    amountRef.current = amount;
  });

  useEffect(() => {
    if (!allowed || !walletRef.current) return;
    let cancelled = false;
    const current = () => amountFor(amountRef.current, amountRef.current.byChoice ? chosen(amountRef.current.byChoice.field) : null);
    let mounted: ReturnType<typeof mountGooglePay>;
    try {
      mounted = mountGooglePay({
        win: window,
        clover,
        elements,
        mountSelector: `#${MOUNT_ID}`,
        amountCents: current(),
        submit: (payment) => walletRef.current!.submit({ ...payment, wallet: "google_pay" }),
        showError: (message) => walletRef.current?.showError(message),
        onRemoved: () => !cancelled && setRemoved(true),
      });
    } catch {
      return; // Clover's SDK without Google Pay: the card form is still there.
    }
    control.current = mounted;
    loadGoogleScript()
      .then(() => googlePayReady(window.google, environment))
      .then((yes) => !cancelled && setReady(yes))
      .catch(() => {
        // pay.js blocked or offline: no Google Pay, the card form is still there.
      });
    // The reward or deposit choice changes the amount without a new page.
    const onChange = (event: Event) => {
      const field = amountRef.current.byChoice?.field;
      if (field && event.target instanceof HTMLInputElement && event.target.name === field) mounted.setAmount(current());
    };
    document.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      document.removeEventListener("change", onChange);
      mounted.destroy();
      control.current = null;
    };
  }, [allowed, clover, elements, environment]);

  // A new total from the server (Pickup / Ship, a bag line changed).
  useEffect(() => {
    control.current?.setAmount(amountFor(amount, amount.byChoice ? chosen(amount.byChoice.field) : null));
  }, [amount]);

  if (!allowed || !wallet || removed) return null;
  // Mounted from the start (Clover's frame needs the div), but with no height until Google says yes.
  return (
    <div className={ready ? "mb-5" : undefined} aria-hidden={ready ? undefined : true} data-google-pay={ready ? "shown" : "waiting"}>
      <div id={MOUNT_ID} className={ready ? "h-12 w-full overflow-hidden rounded-lg" : "h-0 w-full overflow-hidden"} />
      {ready && (
        <p className="mt-4 flex items-center gap-3 text-sm text-ink-soft" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          or pay by card
          <span className="h-px flex-1 bg-line" />
        </p>
      )}
    </div>
  );
}
