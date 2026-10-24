/**
 * Password rules for staff accounts (D41, audit A23). Staff can approve refunds and change
 * prices, so a weak password is a money risk. Framework-free: the Users collection hook and the
 * first-owner script both use it.
 *
 * - at least 12 characters (and at most 128, which is more than any password manager makes)
 * - not a few characters repeated, not a run like 123456789012 or abcdefghijkl, not a very common
 *   password, and not built on the shop's own name
 * - under 16 characters it must mix at least three of: lowercase, capitals, numbers, symbols. From
 *   16 characters on a passphrase of plain words is fine.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
/** Passwords shorter than this must also mix character kinds. */
const PASSPHRASE_LENGTH = 16;

/** Lowercase letters and digits only, the form compared against the lists below. */
const squash = (password: string) => password.toLowerCase().replace(/[^a-z0-9]/g, "");

const COMMON = new Set([
  "password1234",
  "password12345",
  "password123456",
  "passwordpassword",
  "passw0rd1234",
  "p4ssw0rd1234",
  "changeme1234",
  "changemenow",
  "letmein123456",
  "welcome12345",
  "welcome123456",
  "iloveyou1234",
  "administrator",
  "adminadmin1234",
  "qwertyuiop12",
  "qwertyuiop123",
  "qwertyuiopas",
  "asdfghjkl123",
  "1q2w3e4r5t6y",
  "1qaz2wsx3edc",
  "zaq12wsxcde3",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

const reversed = (s: string) => [...s].reverse().join("");
// Digits and letters in order, wrapping round, so 123456789012 and xyzabcdefghi count as runs.
const RUNS = ["0123456789".repeat(4), "abcdefghijklmnopqrstuvwxyz".repeat(3)].flatMap((run) => [run, reversed(run)]);

/** One character repeated, or a straight run of digits or letters, up or down. */
function isRunOfCharacters(squashed: string): boolean {
  return /^(.)\1*$/.test(squashed) || RUNS.some((run) => run.includes(squashed));
}

function isKeyboardWalk(squashed: string): boolean {
  return KEYBOARD_ROWS.some((row) => row.includes(squashed) || [...row].reverse().join("").includes(squashed));
}

/** What is wrong with this password, in words for the person choosing it, or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (new Set(password).size < 6) return "Use more different characters, not a short pattern repeated.";

  const squashed = squash(password);
  if (COMMON.has(squashed) || isRunOfCharacters(squashed) || isKeyboardWalk(squashed)) return "That password is too easy to guess. Choose a less common one.";
  if (/lodelicious|sousetpink/.test(squashed)) return "Don't build the password on the shop's name.";

  if (password.length < PASSPHRASE_LENGTH) {
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(password)).length;
    if (kinds < 3) return `Mix at least three of lowercase letters, capital letters, numbers and symbols, or use ${PASSPHRASE_LENGTH} characters or more (a few unrelated words works well).`;
  }
  return null;
}
