/**
 * The Cloudflare host (D51): D1 for the database, R2 for uploads, no sharp. Follows Payload's
 * `with-cloudflare-d1` template. Loaded only when DEPLOY_TARGET is "cloudflare"; see `target.ts`.
 *
 * Where the bindings come from:
 * - inside the deployed Worker (and `wrangler dev` / `opennextjs-cloudflare preview`): the real
 *   bindings, through OpenNext's request context;
 * - under the `payload` command line (migrate, run) and `next dev`: wrangler's local emulation
 *   (`.wrangler/state`), or the remote D1 and R2 when CLOUDFLARE_ENV names a wrangler environment
 *   whose bindings are marked `remote` (the `remote` environment in wrangler.jsonc; needs
 *   `wrangler login`).
 */
import fs from "fs";
import path from "path";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { r2Storage } from "@payloadcms/storage-r2";
import type { Config } from "payload";

/**
 * The two bindings Payload needs, typed by the adapters that take them. (`wrangler types` is not
 * used: its generated file also declares every var as an always-present `process.env` key, which
 * is wrong for the Node target and the tests, and its content depends on the local .dev.vars.)
 */
type Bindings = {
  D1: Parameters<typeof sqliteD1Adapter>[0]["binding"];
  R2: Parameters<typeof r2Storage>[0]["bucket"];
};

const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined);

/** True under `payload migrate`, `payload run` and the other `payload` commands. */
const isPayloadCli = () => process.argv.some((value) => realpath(value)?.endsWith(path.join("payload", "bin.js")));

// Adapted from the template: wrangler is a dev dependency that must never be bundled, so its name
// is hidden from the bundler.
async function bindingsFromWrangler(): Promise<Bindings> {
  const { getPlatformProxy } = (await import(/* webpackIgnore: true */ `${"__wrangler".replaceAll("_", "")}`)) as typeof import("wrangler");
  const environment = process.env.CLOUDFLARE_ENV || undefined;
  const proxy = await getPlatformProxy<Bindings>({ environment, remoteBindings: Boolean(environment) });
  return proxy.env;
}

/**
 * `next build` loads this config in several worker processes at once to read each route's
 * settings. It never queries the database (every page that needs data is rendered per request),
 * and starting wrangler's emulation in each process makes them fight over the same local files
 * (SQLITE_BUSY). So during the build the bindings are stand-ins that fail loudly if anything does
 * try to use them, which would mean a page has started to prerender with data.
 */
function buildTimeBindings(): Bindings {
  const standIn = (name: string) =>
    new Proxy(
      {},
      {
        get(_target, property) {
          // Promise checks and inspection must stay harmless.
          if (property === "then" || typeof property === "symbol") return undefined;
          throw new Error(`The ${name} binding is not available during "next build" (asked for ${String(property)}). A page is being prerendered with data; make it dynamic.`);
        },
      },
    );
  return { D1: standIn("D1"), R2: standIn("R2") } as unknown as Bindings;
}

async function bindings(): Promise<Bindings> {
  if (process.env.NEXT_PHASE === "phase-production-build") return buildTimeBindings();
  if (isPayloadCli() || process.env.NODE_ENV !== "production") return bindingsFromWrangler();
  return (await getCloudflareContext({ async: true })).env as unknown as Bindings;
}

type LogFn = (objOrMsg: object | string, msg?: string) => void;

const logLine =
  (level: string, write: (line: string) => void): LogFn =>
  (objOrMsg, msg) => {
    if (typeof objOrMsg === "string") write(JSON.stringify({ level, msg: objOrMsg }));
    else {
      const { err, ...rest } = objOrMsg as { err?: unknown; msg?: string };
      const error = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      write(JSON.stringify({ level, ...rest, ...(error === undefined ? {} : { err: error }), msg: msg ?? rest.msg }));
    }
  };

/**
 * Payload's default logger (pino with pino-pretty) writes through `fs`, which a Worker does not
 * have. This one writes one JSON line per message to the console, which Workers Logs collects.
 */
function consoleLogger() {
  const logger = {
    level: process.env.PAYLOAD_LOG_LEVEL || "info",
    trace: logLine("trace", console.debug),
    debug: logLine("debug", console.debug),
    info: logLine("info", console.log),
    warn: logLine("warn", console.warn),
    error: logLine("error", console.error),
    fatal: logLine("fatal", console.error),
    silent: () => {},
    child: () => logger,
  };
  return logger;
}

export async function cloudflarePlatform(rootDir: string): Promise<Pick<Config, "db" | "logger" | "plugins">> {
  const env = await bindings();
  return {
    db: sqliteD1Adapter({
      binding: env.D1,
      migrationDir: path.resolve(rootDir, "migrations"),
      // Migrations only, as on the Node host (D23).
      push: false,
    }),
    // Inside the Worker only; the command line keeps Payload's readable default.
    logger: process.env.NODE_ENV === "production" && !isPayloadCli() ? (consoleLogger() as unknown as Config["logger"]) : undefined,
    plugins: [
      r2Storage({
        bucket: env.R2,
        collections: { media: true },
      }),
    ],
  };
}
