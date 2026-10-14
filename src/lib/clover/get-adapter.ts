/**
 * Picks the Clover adapter from the environment (D43).
 *  - CLOVER_ADAPTER=fake: the in-memory fake, only when APP_ENV is local/staging/test (a fake on the
 *    live store would mark real stock changes as "sent" without telling Clover).
 *  - CLOVER_MERCHANT_ID or CLOVER_API_TOKEN set: the HTTP adapter, which throws if the config is
 *    incomplete or points at production without CLOVER_SYNC_LIVE=1.
 *  - otherwise none: the scripts say so and do nothing.
 */
import { isPreviewEnv } from "../app-env";

import { CloverPermanentError, type CloverInventoryAdapter } from "./adapter";
import { FakeCloverAdapter } from "./fake-adapter";
import { HttpCloverAdapter } from "./http-adapter";

type EnvLike = Record<string, string | undefined>;

export type AdapterChoice = { kind: "fake" | "http"; adapter: CloverInventoryAdapter } | { kind: "none"; reason: string };

export function getCloverAdapter(env: EnvLike = process.env): AdapterChoice {
  if ((env.CLOVER_ADAPTER ?? "").trim().toLowerCase() === "fake") {
    if (!isPreviewEnv(env)) throw new CloverPermanentError("CLOVER_ADAPTER=fake is only allowed when APP_ENV is local, staging or test", "config");
    return { kind: "fake", adapter: new FakeCloverAdapter([], { autoCreate: true }) };
  }
  if (!env.CLOVER_MERCHANT_ID?.trim() && !env.CLOVER_API_TOKEN?.trim()) {
    return { kind: "none", reason: "Clover is not configured (CLOVER_MERCHANT_ID and CLOVER_API_TOKEN are not set)" };
  }
  return { kind: "http", adapter: new HttpCloverAdapter(env) };
}

/** True when a Clover connection is configured (used by the system check; does not validate it). */
export function cloverConfigured(env: EnvLike = process.env): boolean {
  return Boolean(env.CLOVER_MERCHANT_ID?.trim() && env.CLOVER_API_TOKEN?.trim());
}
