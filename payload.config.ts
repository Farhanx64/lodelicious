import { fileURLToPath } from "url";
import path from "path";

import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";

import { AuditLog } from "./collections/AuditLog";
import { Carts } from "./collections/Carts";
import { Categories } from "./collections/Categories";
import { Inquiries } from "./collections/Inquiries";
import { Media } from "./collections/Media";
import { Members } from "./collections/Members";
import { Orders } from "./collections/Orders";
import { Outbox } from "./collections/Outbox";
import { Products } from "./collections/Products";
import { Reservations } from "./collections/Reservations";
import { RewardAdjustments } from "./collections/RewardAdjustments";
import { RewardEntries } from "./collections/RewardEntries";
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
import { RewardsSettings } from "./globals/RewardsSettings";
import { StoreSettings } from "./globals/StoreSettings";
import { emailAdapterFromEnv } from "./src/lib/email/adapter";
import { csrfOrigins } from "./src/lib/security";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// The host-specific parts (D51): the database, where uploads are stored, image resizing and the
// logger. Node with a SQLite file by default; Cloudflare Workers with D1 and R2 when
// DEPLOY_TARGET=cloudflare. The comparison is written out here (not behind a helper) so the
// bundler drops the branch, and the packages, that this build does not use: see src/platform/target.ts.
const platform =
  process.env.DEPLOY_TARGET === "cloudflare"
    ? await import("./src/platform/cloudflare").then((m) => m.cloudflarePlatform(dirname))
    : await import("./src/platform/node").then((m) => m.nodePlatform(dirname));

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
  // The admin sidebar and dashboard list groups in the order their first collection appears here, then
  // the globals inside them, so the order below is the order staff see:
  //   Orders · Catalog · Inventory · Website · Settings · Staff · System.
  // A group with only globals would sort after every collection group, so each group starts with a collection.
  collections: [
    // Orders: the day-to-day work
    Orders,
    Reservations,
    Inquiries,
    // Catalog
    Products,
    Categories,
    // Inventory
    StockAdjustments,
    StockMovements,
    StockHolds,
    // Rewards (then the Rewards program global) (D47)
    Members,
    RewardEntries,
    RewardAdjustments,
    // Website (then the Store details, Home page and Policies globals)
    Media,
    // Settings (then the Checkout, Gift builder, Events and Inventory globals)
    TaxClasses,
    // Staff
    Users,
    AuditLog,
    // System: written by code, kept for monitoring and reference
    Outbox,
    SyncJobs,
    SourceRecords,
    // Hidden from the admin
    Carts,
  ],
  globals: [StoreSettings, HomePage, Policies, CheckoutSettings, GiftBuilderSettings, EventSettings, InventorySettings, RewardsSettings],
  // Transactional email (D44): the console by default; SMTP only with complete settings (and EMAIL_SEND_LIVE=1 on the live store).
  email: emailAdapterFromEnv(process.env),
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
  ...platform,
  telemetry: false,
});
