import { describe, expect, it } from "vitest";

import { hashPassword, hashResetToken, issueSession, newResetToken, normaliseEmail, readSession, SESSION_DAYS, verifyPassword } from "./credentials";

const SECRET = "unit-test-secret";
const NOW = new Date("2026-10-14T12:00:00Z");

describe("member passwords (D47)", () => {
  it("hashes with a fresh salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
  });

  it("refuses missing or malformed hashes", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "plain-text")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$1$8$1$c2FsdA$a2V5")).toBe(false);
  });
});

describe("member sessions", () => {
  it("round-trips the member and version until it expires", () => {
    const value = issueSession(7, 3, NOW, SECRET);
    expect(readSession(value, NOW, SECRET)).toMatchObject({ memberId: 7, version: 3 });
    expect(readSession(value, new Date(NOW.getTime() + SESSION_DAYS * 86_400_000 + 1), SECRET)).toBeNull();
  });

  it("rejects a changed body, another secret, or junk", () => {
    const value = issueSession(7, 3, NOW, SECRET);
    const [, mac] = value.split(".");
    const forged = `${Buffer.from(JSON.stringify({ m: 1, v: 3, e: NOW.getTime() + 1e9 })).toString("base64url")}.${mac}`;
    expect(readSession(forged, NOW, SECRET)).toBeNull();
    expect(readSession(value, NOW, "other-secret")).toBeNull();
    expect(readSession("nope", NOW, SECRET)).toBeNull();
    expect(readSession(undefined, NOW, SECRET)).toBeNull();
    expect(() => issueSession(1, 0, NOW, "")).toThrow(/PAYLOAD_SECRET/);
  });
});

describe("reset tokens and emails", () => {
  it("makes long random tokens and stores only a hash", () => {
    const t = newResetToken();
    expect(t).toMatch(/^[\w-]{40,}$/);
    expect(hashResetToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(t)).not.toContain(t);
  });

  it("normalises email addresses", () => {
    expect(normaliseEmail("  Pat@Example.TEST ")).toBe("pat@example.test");
  });
});
