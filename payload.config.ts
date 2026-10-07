import { fileURLToPath } from "url";
import path from "path";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";

import { AuditLog } from "./collections/AuditLog";
import { Carts } from "./collections/Carts";
import { Categories } from "./collections/Categories";
import { Inquiries } from "./collections/Inquiries";
import { Media } from "./collections/Media";
import { Orders } from "./collections/Orders";
import { Outbox } from "./collections/Outbox";
import { Products } from "./collections/Products";
import { Reservations } from "./collections/Reservations";
import { SourceRecords } from "./collections/SourceRecords";
import { StockAdjustments } from "./collections/StockAdjustments";
import { StockHolds } from "./collections/StockHolds";
import { StockMovements } from "./collections/StockMovements";
import { SyncJobs } from "./collections/SyncJobs";
import { TaxClasses } from "./collections/TaxClasses";
import { Users } from "./collections/Users";
import { CheckoutSettings } from "./globals/CheckoutSettings";
import { EventSettings } from "./globals/EventSettings";
import { GiftBuilderSettings } from "./globals/GiftBuilderSettings";
import { HomePage } from "./globals/HomePage";
import { InventorySettings } from "./globals/InventorySettings";
import { Policies } from "./globals/Policies";
import { StoreSettings } from "./globals/StoreSettings";
import { csrfOrigins } from "./src/lib/security";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Private, persistent data dir (DB + media live OUTSIDE public_html on the host).
// Locally defaults to ./.data; on cPanel set DATA_DIR to an absolute private path.
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(dirname, ".data");

export default buildConfig({
  admin: {
    user: Users.slug,
    // Built-in avatar: the default Gravatar lookup would send staff email hashes to a third party.
    avatar: "default",
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: " — Lodelicious admin",
    },
  },
  collections: [Orders, Reservations, Inquiries, Products, Categories, Media, TaxClasses, Carts, SourceRecords, Users, AuditLog, SyncJobs, StockMovements, StockHolds, StockAdjustments, Outbox],
  globals: [StoreSettings, HomePage, GiftBuilderSettings, CheckoutSettings, EventSettings, Policies, InventorySettings],
  editor: lexicalEditor(),
  // Cookie-authenticated API requests are accepted only from the site's own origin(s) when
  // NEXT_PUBLIC_SITE_URL is set; unset leaves the allowlist off (local dev, tunnels, tests) (A08, D41).
  csrf: csrfOrigins(process.env),
  // Nothing uses GraphQL (the admin and storefront use the Local API and REST). The routes stay but answer 404 (A08, D41).
  graphQL: { disable: true },
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || `file:${path.resolve(dataDir, "lodelicious.db")}`,
    },
    migrationDir: path.resolve(dirname, "migrations"),
    // Never auto-push schema, even in development. Dev push on SQLite re-creates existing
    // indexes and fails on alternate runs, and it marks the database so that a later
    // non-interactive `payload migrate` silently exits 0 without migrating (D23).
    push: false,
  }),
  sharp,
  telemetry: false,
});
