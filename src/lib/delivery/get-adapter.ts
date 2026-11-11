/**
 * Picks the courier from the environment, mirroring ../clover/get-adapter.ts.
 *  - DELIVERY_ADAPTER=fake: only when APP_ENV is local/staging/test.
 *  - DELIVERY_ADAPTER=doordash|uber: the real adapter. Not written yet, so this refuses.
 *  - otherwise none: checkout offers pickup only, as it does today.
 */
import { isPreviewEnv } from "../app-env";

import { DeliveryError, type DeliveryAdapter } from "./adapter";
import { FakeDeliveryAdapter } from "./fake-adapter";

type EnvLike = Record<string, string | undefined>;

export type DeliveryChoice = { kind: "ready"; adapter: DeliveryAdapter } | { kind: "none"; reason: string };

export function getDeliveryAdapter(env: EnvLike = process.env): DeliveryChoice {
  const want = (env.DELIVERY_ADAPTER ?? "").trim().toLowerCase();
  if (!want) return { kind: "none", reason: "Delivery is not configured (DELIVERY_ADAPTER is not set)" };
  if (want === "fake") {
    if (!isPreviewEnv(env)) throw new DeliveryError("DELIVERY_ADAPTER=fake is only allowed when APP_ENV is local, staging or test", "config");
    return { kind: "ready", adapter: new FakeDeliveryAdapter() };
  }
  if (want === "doordash" || want === "uber") {
    throw new DeliveryError(`The ${want} adapter is not built yet: verify the provider's API in its sandbox first`, "config");
  }
  throw new DeliveryError(`Unknown DELIVERY_ADAPTER "${want}"`, "config");
}
