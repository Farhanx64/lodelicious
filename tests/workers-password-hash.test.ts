import crypto from "crypto";
import path from "path";
import { pathToFileURL } from "url";

const local = (f: string) => pathToFileURL(path.resolve("node_modules/payload/dist/auth/strategies/local", f)).href;
import { afterEach, describe, expect, it, vi } from "vitest";

// D53: Cloudflare Workers refuse native PBKDF2 above 100000 iterations, and Payload uses 600000.
// The patched Payload (patches/payload+3.90.2.patch) falls back to a pure-JS PBKDF2 with the same output.
describe("password hashing on Workers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hashes and verifies when native PBKDF2 refuses 600000 iterations", async () => {
    const native = crypto.pbkdf2;
    vi.spyOn(crypto, "pbkdf2").mockImplementation(((...args: Parameters<typeof crypto.pbkdf2>) => {
      if ((args[2] as number) > 100000) throw new Error("Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).");
      return native(...args);
    }) as typeof crypto.pbkdf2);
    const { generatePasswordSaltHash } = await import(local("generatePasswordSaltHash.js"));
    const { authenticateLocalStrategy } = await import(local("authenticate.js"));
    const { hash, salt } = await generatePasswordSaltHash({ password: "a-long-test-passphrase-42", isPasswordAuthenticated: true });
    expect(hash.startsWith("pbkdf2-sha256-v1:")).toBe(true);
    vi.restoreAllMocks();
    // Native Node (the dev server) must accept the hash the fallback produced.
    expect(await authenticateLocalStrategy({ doc: { hash, salt }, password: "a-long-test-passphrase-42" })).toBeTruthy();
    expect(await authenticateLocalStrategy({ doc: { hash, salt }, password: "wrong" })).toBeNull();
  }, 60000);
});
