/**
 * Runs after `opennextjs-cloudflare build` (D51). OpenNext copies the values of the local `.env`
 * files into the Worker (`.open-next/cloudflare/next-env.mjs`) and uses them for any variable the
 * Worker does not have. Here that would upload this machine's PAYLOAD_SECRET inside the code, and
 * a live Worker missing its secret would quietly run on the development one.
 *
 * This empties that file, so the Worker's settings come from exactly two places: "vars" in
 * wrangler.jsonc and `wrangler secret put` (or `.dev.vars` for the local preview). The build
 * fails if the file is missing or still holds a value afterwards.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(".open-next/cloudflare/next-env.mjs");
if (!fs.existsSync(file)) {
  console.error(`cf-strip-env: ${file} was not found. Did the OpenNext build run, and has its layout changed?`);
  process.exit(1);
}

const before = await import(`${file}?before`);
const names = Object.keys(before);
const dropped = new Set(names.flatMap((name) => Object.keys(before[name] ?? {})));
fs.writeFileSync(file, names.map((name) => `export const ${name} = {};`).join("\n") + "\n");

const after = await import(`${file}?after`);
const left = Object.keys(after).flatMap((name) => Object.keys(after[name] ?? {}));
if (names.length === 0 || left.length > 0) {
  console.error("cf-strip-env: could not empty the embedded environment file; do not deploy this build.");
  process.exit(1);
}
// OpenNext also copies the .env files themselves next to the server function. Wrangler does not
// upload them (nothing imports them), but there is no reason to leave secrets in the build folder.
const serverDir = path.resolve(".open-next/server-functions/default");
for (const name of fs.existsSync(serverDir) ? fs.readdirSync(serverDir) : []) {
  if (name === ".env" || name.startsWith(".env.")) fs.rmSync(path.join(serverDir, name));
}

console.log(`cf-strip-env: removed ${dropped.size} local .env value(s) from the Worker (${[...dropped].sort().join(", ") || "none"}).`);
