/**
 * Money as integer US cents.
 *
 * Every price, packaging fee and budget is an integer number of cents so floating-point
 * rounding never reaches a price or a budget check. Parse user/source input with
 * `parseCents`; never multiply a float dollar amount by 100.
 */

export type Cents = number;

const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Not an integer cent amount: ${value}`);
  }
  return value;
}

/** Parse "29.95", "$1,299.00" or "-4.25" without floating-point arithmetic. */
export function parseCents(amount: string): Cents {
  const clean = amount.trim().replace(/[$,\s]/g, "");
  const m = AMOUNT.exec(clean);
  if (!m) {
    throw new RangeError(`Not a money amount: "${amount}"`);
  }
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "0").padEnd(2, "0"));
  return assertCents(m[1] ? -cents : cents);
}

export function sumCents(values: readonly Cents[]): Cents {
  return assertCents(values.reduce((total, v) => total + assertCents(v), 0));
}

export function multiplyCents(value: Cents, quantity: number): Cents {
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError(`Quantity must be an integer: ${quantity}`);
  }
  return assertCents(assertCents(value) * quantity);
}

export function formatCents(value: Cents): string {
  assertCents(value);
  const abs = Math.abs(value);
  const dollars = Math.trunc(abs / 100).toLocaleString("en-US");
  const cents = String(abs % 100).padStart(2, "0");
  return `${value < 0 ? "-" : ""}$${dollars}.${cents}`;
}
