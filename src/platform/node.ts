/**
 * The Node host (D51): a SQLite file through libsql, uploads on disk, sharp for the resized photos.
 * Loaded only when DEPLOY_TARGET is not "cloudflare"; see `target.ts`.
 */
import path from "path";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import type { Config } from "payload";
import sharp from "sharp";

export function nodePlatform(rootDir: string): Pick<Config, "db" | "sharp"> {
  // Private, persistent data dir (database and uploads). Locally defaults to ./.data.
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(rootDir, ".data");
  return {
    db: sqliteAdapter({
      client: {
        url: process.env.DATABASE_URI || `file:${path.resolve(dataDir, "lodelicious.db")}`,
      },
      migrationDir: path.resolve(rootDir, "migrations"),
      // How long a write waits for another connection (the cron scripts, a second request) before
      // failing with SQLITE_BUSY. The default is 0. Do NOT enable `transactionOptions` (D40, D42).
      busyTimeout: 5000,
      // Never auto-push schema, even in development. Dev push on SQLite re-creates existing
      // indexes and fails on alternate runs, and it marks the database so that a later
      // non-interactive `payload migrate` silently exits 0 without migrating (D23).
      push: false,
    }),
    sharp,
  };
}
