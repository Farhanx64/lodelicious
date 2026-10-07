import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bow } from "@/components/brand/Bow";
import { secondaryButton } from "@/components/checkout/styles";
import { Summary } from "@/components/checkout/Summary";
import { findByToken } from "@/src/lib/checkout/service";
import { checkoutPayload } from "@/src/lib/checkout/session";
import { singleParam } from "@/src/lib/checkout/token-param";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

type OrderLine = { unitId: string; title: string; option: string | null; quantity: number; lineTotalCents: number };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const [{ payload }, store] = await Promise.all([checkoutPayload(), getStoreSettings()]);
  const order = await findByToken(payload, "orders", number, singleParam(t));
  if (!order) notFound();
  const lines = order.lines as OrderLine[];

  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      <Bow className="mx-auto mb-3 w-14 text-gold" />
      <h1 className="mb-2 text-center text-[clamp(1.75rem,5vw,2.5rem)]">Thank you</h1>
      <p className="mb-6 text-center text-lg">
        Order <strong>{order.number}</strong> {order.paymentStatus === "paid" ? "is confirmed" : "is awaiting payment"}.
      </p>
      {order.testMode && (
        <p role="note" className="mb-6 border border-gold bg-blush p-4">
          This was a <strong>test order</strong>: no money moved and it won&rsquo;t be prepared.
        </p>
      )}
      <section aria-labelledby="pickup" className="mb-6 border border-gold bg-paper p-5">
        <h2 id="pickup" className="mb-2 text-xl">
          Pickup
        </h2>
        <p>
          {order.pickup.label}
          <br />
          {store.name}, {store.street}, {store.locality}
        </p>
        <p className="mt-2 text-sm text-ink-soft">Keep this page&rsquo;s link: it&rsquo;s your receipt. We&rsquo;ll contact {order.customer.email} if anything changes.</p>
      </section>
      <Summary
        lines={lines.map((l) => ({ key: l.unitId, title: l.title, detail: l.option, quantity: l.quantity, totalCents: l.lineTotalCents }))}
        subtotalCents={order.totals.subtotalCents}
        taxCents={order.totals.taxCents}
        totalCents={order.totals.totalCents}
        taxApproved={Boolean(order.totals.taxApproved)}
      />
      <p className="mt-6 text-center">
        <Link href="/shop" className={secondaryButton}>
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
