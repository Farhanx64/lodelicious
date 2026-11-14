/** The Clover payments adapter against recorded-style fixtures (D54). No network, no real keys. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { chargeSafely } from "../checkout/service";
import { CloverPaymentProvider, cloverConfigFrom, CLOVER_HOSTS } from "./clover";
import { cardDeclined, createdOrder, FAKE_CLOVER_ENV, paidOrder, partiallyPaidOrder, scriptedFetch, serverError } from "./clover-fixtures";
import { getPaymentProvider, paymentsCheck, resolvePayments, testProvider } from "./index";
import type { ChargeInput } from "./types";

const config = cloverConfigFrom(FAKE_CLOVER_ENV);
const SECRET = FAKE_CLOVER_ENV.CLOVER_ECOMM_PRIVATE_TOKEN;

function input(patch: Partial<ChargeInput> = {}): ChargeInput {
  return {
    reference: "SP-1001",
    amountCents: 2862,
    idempotencyKey: "order-key:1",
    source: "clv_1TSTabcdefgh",
    clientIp: "203.0.113.9",
    order: {
      email: "pat@example.test",
      customerName: "Pat Customer",
      phone: "(508) 555-0100",
      lines: [
        { description: "2 × Phillips Dark Chocolate Bar", amountCents: 850, taxCents: 53, taxName: "Sales Tax", taxRateBasisPoints: 625 },
        { description: "1 × Small gift basket", amountCents: 1000, taxCents: 63, taxName: "Sales Tax" },
      ],
      shippingCents: 895,
      fulfillmentNote: "SP-1001: Ship to Pat, 1 Main St, Boston, MA 02108",
      customerNote: "Gift wrap please",
      shipTo: { name: "Pat", line1: "1 Main St", line2: "", city: "Boston", state: "MA", zip: "02108" },
      orderTotalCents: 2861,
    },
    ...patch,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Clover payments configuration", () => {
  it("needs all three variables and a known environment, and never echoes a value", () => {
    expect(() => cloverConfigFrom({ CLOVER_ECOMM_PUBLIC_KEY: "pub_test_0000000000000000" })).toThrow(/CLOVER_ECOMM_PRIVATE_TOKEN, CLOVER_ECOMM_ENVIRONMENT/);
    expect(() => cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_ENVIRONMENT: "live" })).toThrow(/sandbox" or "production/);
    expect(() => cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_PUBLIC_KEY: SECRET })).toThrow(/same value/);
    try {
      cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_PRIVATE_TOKEN: "bad token!" });
    } catch (e) {
      expect((e as Error).message).not.toContain("bad token");
    }
  });

  it("uses Clover on staging (sandbox), refuses sandbox keys on the live store, and falls back to the test payment otherwise", () => {
    const staging = resolvePayments({ APP_ENV: "staging", ...FAKE_CLOVER_ENV });
    expect(staging.provider).toMatchObject({ id: "clover", test: true, needsCardToken: true });
    expect(staging.provider?.browser).toEqual({ kind: "clover", sdkUrl: CLOVER_HOSTS.sandbox.sdk, publicKey: FAKE_CLOVER_ENV.CLOVER_ECOMM_PUBLIC_KEY, merchantId: null, applePay: false, googlePay: false });

    expect(resolvePayments({ APP_ENV: "production", ...FAKE_CLOVER_ENV })).toMatchObject({ provider: null, problem: expect.stringMatching(/sandbox keys are refused/) });
    expect(resolvePayments({ ...FAKE_CLOVER_ENV })).toMatchObject({ provider: null }); // unset APP_ENV is live
    const live = getPaymentProvider({ APP_ENV: "production", ...FAKE_CLOVER_ENV, CLOVER_ECOMM_ENVIRONMENT: "production" });
    expect(live).toMatchObject({ id: "clover", test: false });
    expect(live?.browser).toMatchObject({ sdkUrl: "https://checkout.clover.com/sdk.js" });

    // A half-finished setup closes checkout and says why, rather than silently using the test payment.
    expect(resolvePayments({ APP_ENV: "staging", CLOVER_ECOMM_PUBLIC_KEY: "pub_test_0000000000000000" })).toMatchObject({ provider: null, problem: expect.stringMatching(/need/) });
    expect(getPaymentProvider({ APP_ENV: "staging" })).toBe(testProvider);
    expect(getPaymentProvider({ APP_ENV: "production" })).toBeNull();
  });

  it("reports the provider on the system check without printing any key", () => {
    const line = paymentsCheck({ APP_ENV: "production", ...FAKE_CLOVER_ENV, CLOVER_ECOMM_ENVIRONMENT: "production" });
    expect(line).toMatchObject({ actual: "Clover production", ok: true });
    expect(JSON.stringify(line)).not.toContain(SECRET);
    expect(JSON.stringify(line)).not.toContain(FAKE_CLOVER_ENV.CLOVER_ECOMM_PUBLIC_KEY);
    expect(paymentsCheck({ APP_ENV: "production", ...FAKE_CLOVER_ENV })).toMatchObject({ ok: false });
    expect(paymentsCheck({ APP_ENV: "production" })).toMatchObject({ ok: true, actual: expect.stringMatching(/call to order/) });
  });
});

describe("a Clover charge: order, then pay", () => {
  it("creates the order with lines, tax, shipping, the customer and the fulfillment note, then pays it with the token", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(2861) }, { status: 200, body: paidOrder(2861) });
    const remembered: string[] = [];
    const provider = new CloverPaymentProvider(config, { fetch });
    const result = await provider.charge(input({ amountCents: 2861, onProviderOrder: async (id) => void remembered.push(id) }));

    expect(result).toEqual({ status: "paid", reference: "CHG789XYZ", providerOrderId: "ORD123ABC456" });
    expect(remembered).toEqual(["ORD123ABC456"]);
    const [create, pay] = calls;
    expect(create.url).toBe("https://scl-sandbox.dev.clover.com/v1/orders");
    expect(create.headers).toMatchObject({ authorization: `Bearer ${SECRET}`, "idempotency-key": "order-key:1:order", "x-forwarded-for": "203.0.113.9" });
    expect(create.body).toEqual({
      currency: "usd",
      email: "pat@example.test",
      items: [
        { type: "sku", amount: 850, currency: "usd", quantity: 1, description: "2 × Phillips Dark Chocolate Bar", tax_rates: [{ name: "Sales Tax", rate: 625000 }] },
        { type: "sku", amount: 1000, currency: "usd", quantity: 1, description: "1 × Small gift basket", tax_rates: [{ name: "Sales Tax", rate: 630000 }] },
        { type: "shipping", amount: 895, currency: "usd", quantity: 1, description: "Shipping" },
      ],
      shipping: { name: "Pat", phone: "(508) 555-0100", address: { line1: "1 Main St", city: "Boston", state: "MA", postal_code: "02108", country: "US" } },
      metadata: {
        website_number: "SP-1001",
        customer_name: "Pat Customer",
        customer_phone: "(508) 555-0100",
        fulfillment: "SP-1001: Ship to Pat, 1 Main St, Boston, MA 02108",
        customer_note: "Gift wrap please",
      },
    });
    expect(pay.url).toBe("https://scl-sandbox.dev.clover.com/v1/orders/ORD123ABC456/pay");
    expect(pay.headers["idempotency-key"]).toBe("order-key:1:pay");
    expect(pay.body).toEqual({ source: "clv_1TSTabcdefgh", email: "pat@example.test", ecomind: "ecom" });
  });

  it("pays only the deposit of a reservation, leaving the balance on the Clover order", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(10000) }, { status: 200, body: partiallyPaidOrder(10000, 2500) });
    const base = input();
    const result = await new CloverPaymentProvider(config, { fetch }).charge({ ...base, amountCents: 2500, order: { ...base.order!, shippingCents: 0, shipTo: null, lines: [{ description: "Basket", amountCents: 9412, taxCents: 588, taxName: "Sales Tax" }], orderTotalCents: 10000 } });
    expect(result).toMatchObject({ status: "paid", providerOrderId: "ORD123ABC456" });
    expect(calls[1].body).toMatchObject({ amount: 2500 });
    expect(calls[0].body).not.toHaveProperty("shipping");
  });

  it("refuses to pay when Clover's order total differs from ours by even a cent", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(2862) });
    const result = await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: 2861 }));
    expect(result).toMatchObject({ status: "failed", providerOrderId: "ORD123ABC456", message: expect.stringMatching(/Nothing was charged/) });
    expect(calls).toHaveLength(1); // never reached the pay call
  });

  it("treats a failure before paying as a plain failure (nothing charged), including Clover being down", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const answer of [{ status: 500, body: serverError }, "network-error" as const, { status: 401, body: { error: { type: "authentication_error", message: `bad token ${SECRET}` } } }]) {
      const { fetch, calls } = scriptedFetch(answer);
      expect(await new CloverPaymentProvider(config, { fetch }).charge(input())).toMatchObject({ status: "failed", message: expect.stringMatching(/Nothing was charged/) });
      expect(calls).toHaveLength(1);
    }
    expect(spy.mock.calls.flat().join(" ")).not.toContain(SECRET);
  });

  it("a declined card is failed with a plain message, never Clover's raw text", async () => {
    const { fetch } = scriptedFetch({ status: 200, body: createdOrder(2861) }, { status: 402, body: cardDeclined });
    const result = await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: 2861 }));
    expect(result).toEqual({ status: "failed", reference: "ORD123ABC456", providerOrderId: "ORD123ABC456", message: "Your card was declined. Please try another card." });
  });

  it("no clear answer from the pay call is unknown: the customer may have been charged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const answer of [{ status: 503, body: serverError }, "network-error" as const, { status: 429, body: { error: { type: "rate_limit_error" } } }]) {
      const { fetch } = scriptedFetch({ status: 200, body: createdOrder(2861) }, answer);
      const remembered: string[] = [];
      const result = await chargeSafely(new CloverPaymentProvider(config, { fetch }), input({ amountCents: 2861, onProviderOrder: async (id) => void remembered.push(id) }), 5_000);
      expect(result.status).toBe("unknown");
      expect(remembered).toEqual(["ORD123ABC456"]); // saved before paying, so it can be looked up later
    }
    expect(spy.mock.calls.flat().join(" ")).not.toContain(SECRET);
  });

  it("a 200 that doesn't say paid is unknown too", async () => {
    const { fetch } = scriptedFetch({ status: 200, body: createdOrder(2861) }, { status: 200, body: createdOrder(2861) });
    expect(await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: 2861 }))).toMatchObject({ status: "unknown" });
  });

  it("an order already paid (a retried attempt) is paid, not charged again", async () => {
    const { fetch } = scriptedFetch({ status: 200, body: createdOrder(2861) }, { status: 400, body: { error: { type: "invalid_request_error", code: "order_already_paid" } } });
    expect(await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: 2861 }))).toMatchObject({ status: "paid", providerOrderId: "ORD123ABC456" });
  });

  it("asks for card details before calling Clover at all", async () => {
    const { fetch, calls } = scriptedFetch();
    const provider = new CloverPaymentProvider(config, { fetch });
    expect(await provider.charge(input({ source: undefined }))).toMatchObject({ status: "failed", message: "Please enter your card details." });
    expect(await provider.charge(input({ source: "4242424242424242" }))).toMatchObject({ status: "failed" });
    expect(calls).toHaveLength(0);
  });
});

describe("looking a Clover order up (reconciling an unknown payment)", () => {
  it("reads the order and says paid, not paid or unknown; it never writes", async () => {
    const answers = scriptedFetch({ status: 200, body: paidOrder(2861) }, { status: 200, body: createdOrder(2861) }, { status: 200, body: partiallyPaidOrder(10000, 2500) }, { status: 500, body: serverError });
    const provider = new CloverPaymentProvider(config, { fetch: answers.fetch });
    expect(await provider.lookup("ORD123ABC456", 2861)).toEqual({ status: "paid", reference: "CHG789XYZ" });
    expect(await provider.lookup("ORD123ABC456", 2861)).toEqual({ status: "not_paid" });
    expect(await provider.lookup("ORD123ABC456", 2500)).toMatchObject({ status: "paid" });
    expect(await provider.lookup("ORD123ABC456", 2861)).toEqual({ status: "unknown" });
    expect(await provider.lookup("../../v1/charges", 1)).toEqual({ status: "unknown" });
    expect(answers.calls.map((c) => c.method)).toEqual(["GET", "GET", "GET", "GET"]);
    expect(answers.calls[0].url).toBe("https://scl-sandbox.dev.clover.com/v1/orders/ORD123ABC456");
  });
});

describe("Clover tax rates (live 400: Could not find tax rate for line item)", () => {
  it("sends the merchant's tax rate by name and Clover rate units, not an amount", async () => {
    const { cloverTaxRate } = await import("./clover");
    expect(cloverTaxRate(625, 850, 53)).toBe(625000);
    expect(cloverTaxRate(null, 1000, 63)).toBe(630000);
  });
});

describe("Clover tax by ship-to state (D65)", () => {
  const items = async (tax: NonNullable<ChargeInput["order"]>["tax"], lines?: NonNullable<ChargeInput["order"]>["lines"], total = 2861) => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(total) }, { status: 200, body: paidOrder(total) });
    const base = input().order!;
    await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: total, order: { ...base, lines: lines ?? base.lines, orderTotalCents: total, tax } }));
    return { items: (calls[0].body as { items: Record<string, unknown>[] }).items, calls };
  };

  it("an untaxed ship-to state sends every line on Clover's NO_TAX_APPLIED rate, so Clover adds no tax; shipping stays untaxed", async () => {
    const untaxed = [
      { description: "2 × Phillips Dark Chocolate Bar", amountCents: 850, taxCents: 0, taxName: "Sales Tax", taxRateBasisPoints: 0 },
      { description: "1 × Small gift basket", amountCents: 1000, taxCents: 0, taxName: "Sales Tax" },
    ];
    const { items: sent } = await items({ kind: "none" }, untaxed, 2745);
    expect(sent.slice(0, 2).map((i) => i.tax_rates)).toEqual([[{ name: "NO_TAX_APPLIED", rate: 0 }], [{ name: "NO_TAX_APPLIED", rate: 0 }]]);
    expect(sent[2]).toEqual({ type: "shipping", amount: 895, currency: "usd", quantity: 1, description: "Shipping" });
  });

  it("a listed state uses its own Clover rate name; pickup and an unnamed state keep the default", async () => {
    expect((await items({ kind: "named", cloverTaxName: "NY State Tax" })).items[0].tax_rates).toEqual([{ name: "NY State Tax", rate: 625000 }]);
    expect((await items({ kind: "named", cloverTaxName: null })).items[0].tax_rates).toEqual([{ name: "Sales Tax", rate: 625000 }]);
    expect((await items({ kind: "default" })).items[0].tax_rates).toEqual([{ name: "Sales Tax", rate: 625000 }]);
    expect((await items(undefined)).items[0].tax_rates).toEqual([{ name: "Sales Tax", rate: 625000 }]);
  });

  it("refuses to pay when Clover's total includes tax we didn't charge (total mismatch)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const untaxed = [{ description: "1 × Fudge", amountCents: 1000, taxCents: 0, taxName: "Sales Tax", taxRateBasisPoints: 0 }];
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1958) });
    const base = input().order!;
    const result = await new CloverPaymentProvider(config, { fetch }).charge(input({ amountCents: 1895, order: { ...base, lines: untaxed, orderTotalCents: 1895, tax: { kind: "none" } } }));
    expect(result).toMatchObject({ status: "failed", message: expect.stringMatching(/Nothing was charged/) });
    expect(calls).toHaveLength(1);
  });
});
