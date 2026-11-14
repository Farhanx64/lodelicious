/**
 * Clover ecommerce answers for tests (D54), shaped after Clover's published examples. Nothing here
 * came from a real account; ids and keys are made up.
 */
export const FAKE_CLOVER_ENV = {
  CLOVER_ECOMM_ENVIRONMENT: "sandbox",
  CLOVER_ECOMM_PUBLIC_KEY: "pub_test_0000000000000000",
  CLOVER_ECOMM_PRIVATE_TOKEN: "priv_test_1111111111111111111111",
} as const;

export const createdOrder = (amount: number, id = "ORD123ABC456") => ({
  id,
  object: "order",
  amount,
  amount_paid: 0,
  currency: "usd",
  status: "created",
  livemode: false,
});

export const paidOrder = (amount: number, id = "ORD123ABC456", charge = "CHG789XYZ") => ({
  id,
  object: "order",
  amount,
  amount_paid: amount,
  currency: "usd",
  status: "paid",
  charge,
  livemode: false,
});

export const partiallyPaidOrder = (amount: number, paid: number, id = "ORD123ABC456", charge = "CHG789XYZ") => ({
  ...paidOrder(amount, id, charge),
  amount_paid: paid,
  status: "partially_paid",
});

export const cardDeclined = {
  error: { type: "card_error", code: "card_declined", decline_code: "do_not_honor", message: "The card was declined." },
};

export const serverError = { error: { type: "api_error", code: "processing_error", message: "Internal error" } };

export type RecordedCall = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A scripted stand-in for `fetch`: answers in order, records every call. */
export function scriptedFetch(...answers: ({ status: number; body: unknown } | "network-error")[]) {
  const calls: RecordedCall[] = [];
  const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected Clover call ${init.method} ${url}`);
    if (next === "network-error") throw new Error("socket hang up");
    return { status: next.status, json: async () => next.body };
  };
  return { fetch, calls };
}

/**
 * The `detail` of the `paymentMethod` event Clover's Apple Pay button fires on `window` (D59),
 * shaped after the example on Clover's "Clover iframe features: Apple Pay" page (Clover spells it
 * `tokenRecieved`). Made up; the token's `clv_` prefix is assumed and must be confirmed live.
 */
/**
 * What Clover's SDK hands the Google Pay element's `paymentMethod` listener after its frame tokenizes
 * (`{ card, token, customer: { email, billingInfo } }`, D63). Made up; the `clv_` prefix is assumed.
 */
export const googlePayPaymentMethod = (token = "clv_1TSTgooglepaytoken") => ({
  card: { brand: "VISA", last4: "4242", exp_month: "12", exp_year: "2030" },
  token,
  customer: { email: "ann@example.test", billingInfo: { cardNetwork: "VISA", cardDetails: "4242" } },
});

export const applePayPaymentMethod = (id = "clv_1TSTapplepaytoken") => ({
  tokenRecieved: {
    id,
    wallet: { address_zip: "02703", address_country: "US", exp_month: "12", exp_year: "2030", last4: "4242", first6: "424242" },
  },
  customerEmail: "ann@example.test",
  status: "success",
});
