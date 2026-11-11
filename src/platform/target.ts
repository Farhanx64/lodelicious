/**
 * Which host this build is for (D51).
 *
 * - unset (the default): a plain Node process with a SQLite file and uploads on disk. This is what
 *   `npm run dev`, the test suite and the `payload` scripts use.
 * - "cloudflare": Cloudflare Workers through OpenNext, with D1 for the database and R2 for uploads.
 *   The `cf:*` package scripts set it.
 *
 * `next.config.ts` inlines DEPLOY_TARGET into the bundle, so the branch that is not taken (and the
 * packages only it imports: libsql and sharp on one side, the D1 and R2 adapters on the other) is
 * dropped at build time. Always compare `process.env.DEPLOY_TARGET` directly in an `if` or a
 * ternary around a dynamic `import()`; a helper function would hide the constant from the bundler.
 */
export const isCloudflareTarget = process.env.DEPLOY_TARGET === "cloudflare";
