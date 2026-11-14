/**
 * Temporary Apple Pay diagnostics (D62): records which messages Clover's frames post to the page
 * (names only) and any page errors, and beacons them to /wallet-log. Remove once Apple Pay works.
 */
const CLOVER_ORIGINS = ["https://checkout.clover.com", "https://checkout.sandbox.dev.clover.com"];
const NOISY = new Set(["updateFrameStyles", "onChangeEvent", "onFocusEvent", "onBlurEvent"]);

export function startApplePayDiag(win: Window): { note(event: string): void; stop(): void } {
  const id = Math.random().toString(36).slice(2, 10);
  const t0 = Date.now();
  let queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!queue.length) return;
    const body = JSON.stringify({ id, ua: win.navigator.userAgent, events: queue });
    queue = [];
    try {
      if (!win.navigator.sendBeacon?.("/wallet-log", new Blob([body], { type: "application/json" }))) {
        void fetch("/wallet-log", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
      }
    } catch {
      // Diagnostics must never affect checkout.
    }
  };
  const note = (event: string) => {
    queue.push(`+${Date.now() - t0}ms ${event}`);
    if (!timer) timer = setTimeout(flush, 400);
  };
  const onMessage = (e: MessageEvent) => {
    if (!CLOVER_ORIGINS.includes(e.origin)) return;
    try {
      const m = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      const fn = typeof m?.functionToInvoke === "string" ? m.functionToInvoke : "?";
      if (NOISY.has(fn)) return;
      const d = m?.data && typeof m.data === "object" ? m.data : {};
      const keys = Object.keys(d).slice(0, 8).join(",");
      const extra = typeof d.message === "string" ? ` msg=${d.message.slice(0, 120)}` : typeof d.status === "string" ? ` status=${d.status}` : "";
      note(`clover:${fn} [${keys}]${extra}`);
    } catch {
      note("clover:unparsed");
    }
  };
  const onError = (e: ErrorEvent) => note(`error: ${String(e.message).slice(0, 150)}`);
  const onRejection = (e: PromiseRejectionEvent) => note(`rejection: ${String((e.reason as Error)?.message ?? e.reason).slice(0, 150)}`);
  const onBlur = () => note("window blur");
  const onFocus = () => note("window focus");
  win.addEventListener("message", onMessage);
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onRejection);
  win.addEventListener("blur", onBlur);
  win.addEventListener("focus", onFocus);
  win.addEventListener("pagehide", flush);
  note("applepay mounted");
  return {
    note,
    stop() {
      win.removeEventListener("message", onMessage);
      win.removeEventListener("error", onError);
      win.removeEventListener("unhandledrejection", onRejection);
      win.removeEventListener("blur", onBlur);
      win.removeEventListener("focus", onFocus);
      win.removeEventListener("pagehide", flush);
      note("applepay unmounted");
      flush();
    },
  };
}
