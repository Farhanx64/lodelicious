import { describe, expect, it } from "vitest";

import {
  customerInquiryReceipt,
  customerOrderConfirmation,
  customerReservationConfirmation,
  escapeHtml,
  staffAttention,
  staffNewInquiry,
  staffNewOrder,
  staffNewReservation,
  type InquiryEmail,
  type OrderEmail,
  type ReservationEmail,
} from "./templates";

const store = { name: "Souset-Pink", street: "24 Manomet Point Rd.", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: "shop@example.test" };

const order: OrderEmail = {
  number: "SP-1001",
  customerName: "Pat Customer",
  lines: [
    { title: "Cape Cod Penuche Fudge", option: "Half pound", quantity: 2, unitPriceCents: 1295, lineTotalCents: 2590 },
    { title: "Toblerone", quantity: 1, unitPriceCents: 450, lineTotalCents: 450 },
  ],
  subtotalCents: 3040,
  taxCents: 0,
  totalCents: 3040,
  taxApproved: true,
  pickupLabel: "Sat, Oct 10, 2:00-2:30 PM",
  notes: "",
  staffReview: false,
  testMode: false,
  link: "https://shop.example.test/order/SP-1001?t=abc_DEF-123",
  adminLink: "https://shop.example.test/admin/collections/orders/7",
  customerEmail: "pat@example.test",
  customerPhone: "(508) 555-0100",
  store,
};

const reservation: ReservationEmail = {
  number: "SPR-1001",
  customerName: "Pat Customer",
  basketTitle: "Custom gift basket",
  components: [{ name: "Fudge", quantity: 2 }, { name: "Toblerone", quantity: 1 }],
  totalCents: 10000,
  taxCents: 0,
  paidCents: 2500,
  balanceDueCents: 7500,
  paidInFull: false,
  pickupLabel: "Sat, Oct 10, 2:00-2:30 PM",
  requests: "",
  staffReview: false,
  testMode: false,
  link: "https://shop.example.test/reservation/SPR-1001?t=xyz",
  adminLink: null,
  store,
};

const inquiry: InquiryEmail = {
  number: "INQ-1001",
  customerName: "Pat Customer",
  topicLabel: "General question",
  itemTitle: null,
  message: "Do you have gluten-free fudge?",
  eventSummary: null,
  adminLink: "https://shop.example.test/admin/collections/inquiries/3",
  customerEmail: "pat@example.test",
  store,
};

describe("customer order confirmation", () => {
  const mail = customerOrderConfirmation(order);

  it("carries the number, items, money, pickup, private link and the store's address and phone", () => {
    expect(mail.subject).toBe("Your order SP-1001 is confirmed");
    for (const part of ["SP-1001", "2 × Cape Cod Penuche Fudge (Half pound)", "$25.90", "$4.50", "Subtotal: $30.40", "Tax: $0.00", "Total paid: $30.40", "Sat, Oct 10, 2:00-2:30 PM", "https://shop.example.test/order/SP-1001?t=abc_DEF-123", "24 Manomet Point Rd.", "Plymouth, MA 02360", "(774) 283-4676"]) {
      expect(mail.text).toContain(part);
    }
    expect(mail.html).toContain('href="https://shop.example.test/order/SP-1001?t=abc_DEF-123"');
    expect(mail.html).toContain("$30.40");
    expect(mail.html).toContain('lang="en"');
  });

  it("uses staff-review wording when the customer left a note, and shows the note", () => {
    const review = customerOrderConfirmation({ ...order, notes: "No nuts please", staffReview: true });
    expect(review.subject).toContain("we are checking your note");
    expect(review.text).toMatch(/a person at the shop will read it before your order is packed/);
    expect(review.text).toContain("No nuts please");
    expect(mail.text).not.toMatch(/staff|person at the shop/i);
  });

  it("leaves out the link line when the site address is unknown, and marks test orders", () => {
    const test = customerOrderConfirmation({ ...order, link: null, testMode: true });
    expect(test.text).not.toContain("View your order");
    expect(test.subject.startsWith("[TEST] ")).toBe(true);
    expect(test.text).toMatch(/test order\. No money moved/);
  });

  it("escapes customer text in HTML and strips line breaks from the subject", () => {
    const evil = customerOrderConfirmation({
      ...order,
      customerName: '<script>alert("x")</script> Pat',
      notes: "<img src=x onerror=alert(1)>\nsecond line & more",
      staffReview: true,
      lines: [{ title: "<b>Bold</b>\r\nBcc: attacker@example.test", quantity: 1, unitPriceCents: 100, lineTotalCents: 100 }],
      pickupLabel: "<i>soon</i>",
    });
    expect(evil.html).not.toContain("<script");
    expect(evil.html).not.toContain("<img");
    expect(evil.html).not.toContain("<b>Bold");
    expect(evil.html).not.toContain("<i>soon");
    expect(evil.html).toContain("&lt;img src=x onerror=alert(1)&gt;<br>second line &amp; more");
    expect(evil.subject).not.toMatch(/[\r\n]/);
    expect(evil.html).toContain('href="https://shop.example.test/order');
  });

  it("only links http(s) URLs", () => {
    const bad = customerOrderConfirmation({ ...order, link: 'javascript:alert("x")' });
    expect(bad.html).not.toContain("javascript:");
  });

  it("contains no secrets: nothing but the fields it is given", () => {
    const all = JSON.stringify([mail, staffNewOrder(order), customerReservationConfirmation(reservation)]);
    expect(all).not.toMatch(/accessTokenHash|idempotency|staffNotes|stockNote|payment\.reference|card/i);
  });
});

describe("customer reservation confirmation", () => {
  it("states the deposit paid, the balance due at pickup, the pickup and the private link", () => {
    const mail = customerReservationConfirmation(reservation);
    expect(mail.subject).toBe("Your basket reservation SPR-1001 is confirmed");
    for (const part of ["Deposit paid: $25.00", "Balance due at pickup: $75.00", "Basket total (with tax): $100.00", "2 × Fudge", "Sat, Oct 10, 2:00-2:30 PM", "https://shop.example.test/reservation/SPR-1001?t=xyz", "(774) 283-4676"]) {
      expect(mail.text).toContain(part);
    }
  });

  it("says paid in full when there is no balance, and uses staff-review wording for requests", () => {
    const full = customerReservationConfirmation({ ...reservation, paidInFull: true, paidCents: 10000, balanceDueCents: 0 });
    expect(full.text).toContain("Paid in full: $100.00");
    expect(full.text).toContain("Balance due at pickup: $0.00");
    const review = customerReservationConfirmation({ ...reservation, requests: "Dairy free", staffReview: true });
    expect(review.subject).toContain("we are checking your requests");
    expect(review.text).toContain("Dairy free");
  });
});

describe("customer inquiry receipt", () => {
  it("gives the number, promises a reply and says nothing is booked or charged", () => {
    const mail = customerInquiryReceipt(inquiry);
    expect(mail.subject).toContain("INQ-1001");
    expect(mail.text).toMatch(/we will reply/i);
    expect(mail.text).toMatch(/Nothing has been booked, reserved or charged/);
    expect(mail.text).toContain("Do you have gluten-free fudge?");
    expect(mail.text).not.toMatch(/\$\d/);
  });

  it("escapes the message", () => {
    const mail = customerInquiryReceipt({ ...inquiry, message: "<script>x</script>" });
    expect(mail.html).not.toContain("<script>");
  });
});

describe("staff emails", () => {
  it("a paid order lists the customer, pickup, totals, lines and the admin link", () => {
    const mail = staffNewOrder(order);
    expect(mail.subject).toBe("New order SP-1001: $30.40, pickup Sat, Oct 10, 2:00-2:30 PM");
    for (const part of ["pat@example.test", "(508) 555-0100", "$30.40", "2 × Cape Cod Penuche Fudge", "/admin/collections/orders/7"]) expect(mail.text).toContain(part);
    expect(mail.text).toContain("ready to prepare");
  });

  it("flags staff review and unapproved tax", () => {
    const mail = staffNewOrder({ ...order, notes: "Nut allergy", staffReview: true, taxApproved: false });
    expect(mail.subject).toContain("needs staff review");
    expect(mail.text).toContain("Nut allergy");
    expect(mail.text).toMatch(/estimate: tax class not approved/);
  });

  it("a reservation shows deposit and balance", () => {
    const mail = staffNewReservation(reservation);
    expect(mail.text).toContain("Deposit paid: $25.00");
    expect(mail.text).toContain("Balance due at pickup: $75.00");
  });

  it("an inquiry shows the contact details and message", () => {
    const mail = staffNewInquiry({ ...inquiry, eventSummary: "2026-12-12, 50 guests" });
    expect(mail.text).toContain("pat@example.test");
    expect(mail.text).toContain("2026-12-12, 50 guests");
    expect(mail.text).toContain("Do you have gluten-free fudge?");
  });

  it("attention emails explain what to do and never include internal notes", () => {
    const unknown = staffAttention({ kind: "order", number: "SP-1002", reason: "unknown_payment", testMode: false, adminLink: null, store });
    expect(unknown.text).toMatch(/UNKNOWN/);
    expect(unknown.text).toMatch(/Do not pack/);
    const stock = staffAttention({ kind: "reservation", number: "SPR-1002", reason: "stock_needs_attention", testMode: false, adminLink: null, store });
    expect(stock.text).toMatch(/stock could not be taken/);
    expect(stock.subject).toContain("Needs attention");
  });
});

describe("escapeHtml", () => {
  it("escapes the five dangerous characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
