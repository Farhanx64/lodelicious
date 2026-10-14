import { describe, expect, it } from "vitest";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordProblem } from "./password-policy";

describe("passwordProblem (A23)", () => {
  it("needs at least 12 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(passwordProblem("Ab1!xyz")).toMatch(/at least 12/);
    expect(passwordProblem("Abcdef1!ghi")).toMatch(/at least 12/); // 11
    expect(passwordProblem("Abcdef1!ghij")).toBeNull(); // 12
  });

  it("accepts the password every test account uses, and ordinary good ones", () => {
    for (const ok of ["test-password-123", "Tr0ub4dor&3xyz", "correct horse battery staple", "bluefishgreenhorsepurple", "k9#Lm2$Qx7!pZ"]) {
      expect(passwordProblem(ok), ok).toBeNull();
    }
  });

  it("rejects repeated, run and keyboard-walk passwords", () => {
    for (const bad of ["aaaaaaaaaaaaaaaa", "abababababababab", "123456789012", "abcdefghijkl", "987654321098", "qwertyuiop12", "Qwertyuiop"]) {
      expect(passwordProblem(bad), bad).not.toBeNull();
    }
  });

  it("rejects very common passwords, however they are capitalised or punctuated", () => {
    for (const bad of ["Password123456", "pass-word-1234", "PASSWORD12345", "Welcome-123456", "Letmein123456!"]) {
      expect(passwordProblem(bad), bad).toMatch(/too easy/);
    }
  });

  it("rejects the shop's name", () => {
    expect(passwordProblem("Lodelicious2026!")).toMatch(/shop's name/);
    expect(passwordProblem("souset-pink-Plymouth1")).toMatch(/shop's name/);
  });

  it("asks a short password to mix character kinds, but lets a long passphrase be plain words", () => {
    expect(passwordProblem("alllowercase")).toMatch(/Mix at least three/);
    expect(passwordProblem("Alllowercase1")).toBeNull();
    expect(passwordProblem("onlylowercasewordsagain")).toBeNull();
  });

  it("has an upper bound so the hash input stays sane", () => {
    expect(passwordProblem("Ab1!".repeat(MAX_PASSWORD_LENGTH))).toMatch(/at most/);
  });
});
