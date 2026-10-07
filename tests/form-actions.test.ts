/**
 * The public server actions (A13, A15): they answer an error with the customer's entries kept, and
 * they stop answering once one visitor has made too many attempts. The services behind them are
 * mocked; the actions, the limiter and the echo helpers run for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ip: "203.0.113.7",
  changeBag: vi.fn(),
  placeOrder: vi.fn(),
  reserveBasket: vi.fn(),
  inquiryFormState: vi.fn(),
  loadBuilderCatalog: vi.fn(),
  readBasketDraft: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `10.0.0.1, ${mocks.ip}` }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/src/lib/checkout/service", () => ({ changeBag: mocks.changeBag, placeOrder: mocks.placeOrder, reserveBasket: mocks.reserveBasket }));
vi.mock("@/src/lib/checkout/session", () => ({
  bagToken: async () => "bag-token-0123456789abcdef",
  ensureBagToken: async () => "bag-token-0123456789abcdef",
  checkoutPayload: async () => ({ payload: {}, ctx: {} }),
  readBasketDraft: mocks.readBasketDraft,
  clearBasketDraft: vi.fn(),
  saveBasketDraft: vi.fn(),
}));
vi.mock("@/src/lib/catalog/builder-data", () => ({ loadBuilderCatalog: mocks.loadBuilderCatalog }));
vi.mock("@/src/lib/inquiries/service", () => ({ inquiryFormState: mocks.inquiryFormState }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: async () => ({}) }));

import { checkBasket, startReservation, submitReservation } from "@/app/(frontend)/build-a-basket/actions";
import { addToBag, submitOrder } from "@/app/(frontend)/cart/actions";
import { submitContact } from "@/app/(frontend)/contact/actions";
import { submitFountain } from "@/app/(frontend)/events/actions";
import { ACTION_LIMITS, TOO_MANY_ATTEMPTS, processLimiter } from "@/src/lib/rate-limit";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const customer = { name: "Ann Lee", email: "ann@example.test", phone: "508-555-0100", pickup: "2026-10-08|11:00", notes: "Ring the bell", payment: "full" };

beforeEach(() => {
  processLimiter().clear();
  mocks.ip = "203.0.113.7";
  for (const m of [mocks.changeBag, mocks.placeOrder, mocks.reserveBasket, mocks.inquiryFormState, mocks.loadBuilderCatalog, mocks.readBasketDraft]) m.mockReset();
});

describe("order and reservation forms keep the customer's entries after an error (A13)", () => {
  it("submitOrder returns the typed values with the error", async () => {
    mocks.placeOrder.mockResolvedValue({ ok: false, error: "That pickup time was just taken." });
    const result = await submitOrder({ error: null }, form({ ...customer, token: "do-not-echo" }));
    expect(result).toEqual({ error: "That pickup time was just taken.", values: customer });
  });

  it("submitReservation returns them too, including when the basket has expired", async () => {
    mocks.readBasketDraft.mockResolvedValue(null);
    expect(await submitReservation({ error: null }, form(customer))).toEqual({ error: "Your basket has expired. Please build it again.", values: customer });

    mocks.readBasketDraft.mockResolvedValue({ request: {}, message: "", requests: "" });
    mocks.reserveBasket.mockResolvedValue({ ok: false, error: "Please choose a pickup time." });
    expect(await submitReservation({ error: null }, form(customer))).toEqual({ error: "Please choose a pickup time.", values: customer });
  });

  it("addToBag keeps the chosen option and quantity", async () => {
    mocks.changeBag.mockResolvedValue({ ok: false, error: "Only 2 left." });
    expect(await addToBag({ error: null }, form({ unitId: "7:pink", quantity: "5" }))).toEqual({ error: "Only 2 left.", values: { unitId: "7:pink", quantity: "5" } });
  });
});

describe("rate limiting (A15)", () => {
  it("limits submitOrder per visitor, keeps their entries, and does no work once limited", async () => {
    mocks.placeOrder.mockResolvedValue({ ok: false, error: "Nope" });
    for (let i = 0; i < ACTION_LIMITS.submitOrder.limit; i++) expect((await submitOrder({ error: null }, form(customer))).error).toBe("Nope");
    expect(await submitOrder({ error: null }, form(customer))).toEqual({ error: TOO_MANY_ATTEMPTS, values: customer });
    expect(mocks.placeOrder).toHaveBeenCalledTimes(ACTION_LIMITS.submitOrder.limit);
  });

  it("counts a different visitor separately, using the address the proxy appended", async () => {
    mocks.placeOrder.mockResolvedValue({ ok: false, error: "Nope" });
    for (let i = 0; i < ACTION_LIMITS.submitOrder.limit + 1; i++) await submitOrder({ error: null }, form(customer));
    mocks.ip = "198.51.100.20";
    expect((await submitOrder({ error: null }, form(customer))).error).toBe("Nope");
  });

  it("limits addToBag", async () => {
    mocks.changeBag.mockResolvedValue({ ok: false, error: "Nope" });
    for (let i = 0; i < ACTION_LIMITS.addToBag.limit; i++) await addToBag({ error: null }, form({ unitId: "7", quantity: "1" }));
    expect((await addToBag({ error: null }, form({ unitId: "7", quantity: "1" }))).error).toBe(TOO_MANY_ATTEMPTS);
    expect(mocks.changeBag).toHaveBeenCalledTimes(ACTION_LIMITS.addToBag.limit);
  });

  it("limits submitReservation", async () => {
    mocks.readBasketDraft.mockResolvedValue(null);
    for (let i = 0; i < ACTION_LIMITS.submitReservation.limit; i++) await submitReservation({ error: null }, form(customer));
    expect(await submitReservation({ error: null }, form(customer))).toEqual({ error: TOO_MANY_ATTEMPTS, values: customer });
    expect(mocks.readBasketDraft).toHaveBeenCalledTimes(ACTION_LIMITS.submitReservation.limit);
  });

  it("limits checkBasket and startReservation without loading the catalog again", async () => {
    mocks.loadBuilderCatalog.mockRejectedValue(new Error("should not be reached for a malformed request"));
    for (let i = 0; i < ACTION_LIMITS.checkBasket.limit; i++) {
      expect(await checkBasket("garbage")).toEqual({ error: "That basket couldn't be read. Please refresh the page and try again." });
    }
    expect(await checkBasket("garbage")).toEqual({ error: TOO_MANY_ATTEMPTS });

    for (let i = 0; i < ACTION_LIMITS.startReservation.limit; i++) await startReservation({ request: "garbage", message: "", requests: "" });
    expect(await startReservation({ request: "garbage", message: "", requests: "" })).toEqual({ error: TOO_MANY_ATTEMPTS });
  });

  it("limits the contact and fountain forms separately and keeps what was typed", async () => {
    mocks.inquiryFormState.mockResolvedValue({ error: null, sent: true, number: "INQ-1001" });
    const message = form({ topic: "general", message: "Do you ship?", name: "Ann", email: "ann@example.test", phone: "555" });
    for (let i = 0; i < ACTION_LIMITS.contact.limit; i++) expect((await submitContact({ error: null }, message)).sent).toBe(true);
    const limited = await submitContact({ error: null }, message);
    expect(limited.error).toBe(TOO_MANY_ATTEMPTS);
    expect(limited.sent).toBeUndefined();
    expect(limited.values).toMatchObject({ message: "Do you ship?", name: "Ann", email: "ann@example.test" });
    expect(mocks.inquiryFormState).toHaveBeenCalledTimes(ACTION_LIMITS.contact.limit);

    // The fountain form has its own allowance.
    expect((await submitFountain({ error: null }, form({ eventDate: "2026-12-01", guests: "40", name: "Ann" }))).sent).toBe(true);
    for (let i = 1; i < ACTION_LIMITS.fountain.limit; i++) await submitFountain({ error: null }, form({ guests: "40" }));
    expect((await submitFountain({ error: null }, form({ eventDate: "2026-12-01", guests: "40", name: "Ann" }))).error).toBe(TOO_MANY_ATTEMPTS);
  });
});
