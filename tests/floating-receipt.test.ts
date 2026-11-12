/**
 * The floating receipt (D58): where it shows, what it adds up to, and the collapsed bar's markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/payload-types";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));

import { FloatingReceipt } from "@/components/receipt/FloatingReceipt";
import { priceCart } from "@/src/lib/checkout/cart";
import { EMPTY_RECEIPT, receiptAllowedOn, receiptFromBag, receiptTaxLabel, showReceipt } from "@/src/lib/checkout/receipt";
import type { TaxClass } from "@/src/lib/checkout/tax";

const MA: TaxClass = { id: "1", name: "Sales tax", rateBasisPoints: 625, approved: true };
const EXEMPT: TaxClass = { id: "2", name: "Food — exempt", rateBasisPoints: 0, approved: true };
const opts = { previewStock: false, taxClasses: [MA, EXEMPT], defaultTaxClassId: "1" };

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 7,
    title: "S'mores Bar",
    slug: "smores",
    category: 1,
    channel: "online",
    priceCents: 425,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 10,
    onlineReserve: 0,
    nutFree: "unknown",
    vegan: "unknown",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

const fudge = product({ id: 8, title: "Maple Fudge", slug: "maple-fudge", priceCents: 1299 });

describe("where the receipt shows", () => {
  it("is hidden while the bag is empty", () => {
    expect(showReceipt("/", 0)).toBe(false);
    expect(showReceipt("/shop", 0)).toBe(false);
    expect(showReceipt("/", 1)).toBe(true);
  });

  it("is hidden on the bag, checkout, reserve and admin pages, and anything under them", () => {
    for (const path of ["/cart", "/checkout", "/checkout?method=ship", "/reserve", "/reserve?method=ship", "/admin", "/admin/collections/orders", "/cart/"]) {
      expect(receiptAllowedOn(path), path).toBe(false);
      expect(showReceipt(path, 3), path).toBe(false);
    }
  });

  it("shows on the other storefront pages, matching whole path segments only", () => {
    for (const path of ["/", "/shop", "/shop/maple-fudge", "/gift-baskets", "/build-a-basket", "/rewards", "/cartoons", "/checkouts", "/order/SP-1"]) {
      expect(showReceipt(path, 1), path).toBe(true);
    }
    expect(showReceipt(null, 1)).toBe(true);
  });
});

describe("receipt totals", () => {
  it("lists every line with quantity and price, and takes subtotal and 6.25% tax from the priced bag", () => {
    const bag = priceCart(
      [
        { unitId: "7", quantity: 2 },
        { unitId: "8", quantity: 1 },
      ],
      [product(), fudge],
      opts,
    );
    const receipt = receiptFromBag(bag, new Map([["8", { src: "/media/fudge-thumb.jpg", alt: "" }]]));
    expect(receipt.itemCount).toBe(3);
    expect(receipt.subtotalCents).toBe(2 * 425 + 1299); // 2149
    // Rounded half-up per line: 850 × 6.25% = 53.125 → 53; 1299 × 6.25% = 81.1875 → 81.
    expect(receipt.taxCents).toBe(134);
    expect(receipt.taxLabel).toBe("Estimated tax (6.25%)");
    expect(receipt.lines.map((l) => [l.title, l.quantity, l.totalCents])).toEqual([
      ["S'mores Bar", 2, 850],
      ["Maple Fudge", 1, 1299],
    ]);
    expect(receipt.lines[1].image?.src).toBe("/media/fudge-thumb.jpg");
    expect(receipt.lines[0].image).toBeNull();
    expect(receipt.blocking).toBe(false);
  });

  it("names no rate when nothing is taxed or rates differ", () => {
    expect(receiptTaxLabel([{ taxClass: EXEMPT }])).toBe("Estimated tax");
    expect(receiptTaxLabel([{ taxClass: MA }, { taxClass: { ...MA, id: "3", rateBasisPoints: 700 } }])).toBe("Estimated tax");
    expect(receiptTaxLabel([{ taxClass: MA }, { taxClass: EXEMPT }])).toBe("Estimated tax (6.25%)");
  });

  it("never shows an unapproved price, and flags a line that can't be bought", () => {
    const bag = priceCart(
      [
        { unitId: "7", quantity: 1 },
        { unitId: "8", quantity: 1 },
      ],
      [product({ priceApproved: false }), fudge],
      opts,
    );
    const receipt = receiptFromBag(bag);
    const smores = receipt.lines.find((l) => l.key === "7");
    expect(smores?.totalCents).toBeNull();
    expect(smores?.unavailable).toBe(true);
    expect(receipt.blocking).toBe(true);
    expect(receipt.subtotalCents).toBe(1299);
  });
});

describe("the collapsed bar", () => {
  const two = receiptFromBag(priceCart([{ unitId: "7", quantity: 1 }, { unitId: "8", quantity: 1 }], [product(), fudge], opts));
  const render = (data = two) => renderToStaticMarkup(createElement(FloatingReceipt, { data }));

  beforeEach(() => {
    nav.pathname = "/shop";
  });

  it("shows the count, subtotal, a collapsed toggle and Checkout", () => {
    const html = render();
    expect(html).toContain("data-receipt");
    expect(html).toContain("2 items");
    expect(html).toContain("$17.24");
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(html).toContain('href="/checkout"');
    expect(html).not.toContain("Your order</h2>"); // the sheet only renders when opened
    expect(html).toContain('role="status" aria-live="polite"');
  });

  it("renders only the empty live region when the bag is empty or on excluded pages", () => {
    expect(render(EMPTY_RECEIPT)).not.toContain("data-receipt");
    for (const path of ["/checkout", "/cart", "/reserve"]) {
      nav.pathname = path;
      const html = render();
      expect(html, path).not.toContain("data-receipt");
      expect(html, path).toContain('role="status"');
    }
  });

  it("sends a bag with an unavailable line to the bag instead of checkout", () => {
    const blocked = receiptFromBag(priceCart([{ unitId: "7", quantity: 1 }], [product({ priceApproved: false })], opts));
    const html = render(blocked);
    expect(html).not.toContain('href="/checkout"');
    expect(html).toContain('href="/cart"');
  });
});
