import "server-only";

import crypto from "node:crypto";

import config from "@payload-config";
import { cookies } from "next/headers";
import { getPayload } from "payload";

import { parseCustomRequest } from "../gifts/request";
import { loadCheckoutContext, newCartToken, readCartLines, type BasketDraft } from "./service";

const BAG = "sp_cart";
const BASKET = "sp_basket";
const secure = process.env.NODE_ENV === "production";

export async function checkoutPayload() {
  const payload = await getPayload({ config });
  return { payload, ctx: await loadCheckoutContext(payload) };
}

export async function bagToken(): Promise<string | undefined> {
  return (await cookies()).get(BAG)?.value;
}

/** The bag cookie: an opaque random token, httpOnly so page scripts can't read it. */
export async function ensureBagToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(BAG)?.value;
  if (existing && /^[\w-]{20,64}$/.test(existing)) return existing;
  const token = newCartToken();
  jar.set(BAG, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return token;
}

export async function bagCount(): Promise<number> {
  const token = await bagToken();
  if (!token) return 0;
  const lines = await readCartLines(await getPayload({ config }), token);
  return lines.reduce((n, l) => n + l.quantity, 0);
}

// The basket being reserved travels in a signed, short-lived cookie: the browser can't change
// its contents, and prices are re-read from the catalog anyway.
function sign(value: string): string {
  return crypto.createHmac("sha256", process.env.PAYLOAD_SECRET ?? "").update(value).digest("base64url");
}

export async function saveBasketDraft(draft: BasketDraft): Promise<void> {
  const body = Buffer.from(JSON.stringify({ ...draft, exp: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
  (await cookies()).set(BASKET, `${body}.${sign(body)}`, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 2 * 60 * 60 });
}

export async function readBasketDraft(): Promise<BasketDraft | null> {
  const raw = (await cookies()).get(BASKET)?.value;
  const [body, mac] = raw?.split(".") ?? [];
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const request = parseCustomRequest(data.request);
    if (!request || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { request, message: String(data.message ?? "").slice(0, 300), requests: String(data.requests ?? "").slice(0, 500) };
  } catch {
    return null;
  }
}

export async function clearBasketDraft(): Promise<void> {
  (await cookies()).delete(BASKET);
}
