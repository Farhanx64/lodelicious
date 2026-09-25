import { fileURLToPath } from "url";
import path from "path";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";

import { AuditLog } from "./collections/AuditLog";
import { Media } from "./collections/Media";
import { SourceRecords } from "./collections/SourceRecords";
import { SyncJobs } from "./collections/SyncJobs";
import { Users } from "./collections/Users";
import { StoreSettings } from "./globals/StoreSettings";

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
  collections: [Users, Media, SourceRecords, AuditLog, SyncJobs],
  globals: [StoreSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || `file:${path.resolve(dataDir, "lodelicious.db")}`,
    },
    migrationDir: path.resolve(dirname, "migrations"),
  }),
  sharp,
  telemetry: false,
});
