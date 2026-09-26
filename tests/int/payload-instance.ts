/**
 * Payload for integration tests: a fresh SQLite file per test file (tests/setup-env.ts) with the
 * real migrations applied — the same path production takes, since schema push is disabled.
 */
import config from "@payload-config";
import { getPayload, type Payload } from "payload";

import { migrations } from "@/migrations";

export async function getTestPayload(): Promise<Payload> {
  const payload = await getPayload({ config });
  // Payload's generated migration modules are typed with concrete args while db.migrate()
  // declares `unknown` args; the runtime shape is identical.
  await payload.db.migrate({ migrations: migrations as never });
  return payload;
}
