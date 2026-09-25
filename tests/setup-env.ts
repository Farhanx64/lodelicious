/**
 * Runs before each test file is imported: point Payload at a fresh temporary database so tests
 * never touch .data/ and never share state.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ldl-test-"));
fs.mkdirSync(path.join(dir, "media"));

process.env.DATA_DIR = dir;
process.env.MEDIA_DIR = path.join(dir, "media");
process.env.DATABASE_URI = `file:${path.join(dir, "test.db")}`;
process.env.PAYLOAD_SECRET = "test-secret-test-secret-test-secret-00";
process.env.APP_ENV = "test";
