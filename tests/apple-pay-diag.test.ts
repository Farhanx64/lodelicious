import { describe, expect, it } from "vitest";

import { POST } from "@/app/(frontend)/wallet-log/route";

describe("/wallet-log (D62)", () => {
  it("accepts a small event list", async () => {
    const res = await POST(new Request("http://x/wallet-log", { method: "POST", body: JSON.stringify({ id: "abc", ua: "Safari", events: ["+1ms clover:onAppleButtonClick [elementType]"] }) }));
    expect(res.status).toBe(204);
  });
  it("refuses oversized or invalid bodies", async () => {
    expect((await POST(new Request("http://x", { method: "POST", body: "x".repeat(5000) }))).status).toBe(413);
    expect((await POST(new Request("http://x", { method: "POST", body: "not json" }))).status).toBe(400);
  });
});
