import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bow } from "@/components/brand/Bow";
import { secondaryButton } from "@/components/checkout/styles";
import { findByToken } from "@/src/lib/checkout/service";
import { checkoutPayload } from "@/src/lib/checkout/session";
import { singleParam } from "@/src/lib/checkout/token-param";
import { formatCents } from "@/src/lib/money";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Basket reserved", robots: { index: false } };

type Snapshot = { title: string; components: { productId: string; name: string; quantity: number }[]; message?: string; requests?: string };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const [{ payload }, store] = await Promise.all([checkoutPayload(), getStoreSettings()]);
  const r = await findByToken(payload, "reservations", number, singleParam(t));
  if (!r) notFound();
  const basket = r.basket as Snapshot;

  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      <Bow className="mx-auto mb-3 w-14 text-gold" />
      <h1 className="mb-2 text-center text-[clamp(1.75rem,5vw,2.5rem)]">Basket reserved</h1>
      <p className="mb-6 text-center text-lg">
        Reservation <strong>{r.number}</strong>
      </p>
      {r.testMode && (
        <p role="note" className="mb-6 border border-gold bg-blush p-4">
          This was a <strong>test reservation</strong>: no money moved and it won&rsquo;t be prepared.
        </p>
      )}
      {r.reservationStatus === "staff_review" && (
        <p className="mb-6 border-l-4 border-gold bg-paper p-4">We&rsquo;ll contact you to confirm your requests before we make your basket.</p>
      )}
      <section aria-labelledby="pickup" className="mb-6 border border-gold bg-paper p-5">
        <h2 id="pickup" className="mb-2 text-xl">
          Pickup
        </h2>
        <p>
          {r.pickup.label}
          <br />
          {store.name}, {store.street}, {store.locality}
        </p>
      </section>
      <section aria-labelledby="basket" className="mb-6 border border-gold bg-paper p-5">
        <h2 id="basket" className="mb-2 text-xl">
          {basket.title}
        </h2>
        <ul className="mb-3 list-disc pl-5">
          {basket.components.map((c) => (
            <li key={c.productId}>
              {c.quantity} × {c.name}
            </li>
          ))}
        </ul>
        {basket.message && <p className="text-sm">Gift message: &ldquo;{basket.message}&rdquo;</p>}
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-3">
          <dt>Basket total{r.taxApproved ? "" : " (tax estimated)"}</dt>
          <dd className="text-right">{formatCents(r.totalCents)}</dd>
          <dt>Paid now</dt>
          <dd className="text-right">{formatCents(r.amountPaidCents)}</dd>
          <dt className="font-semibold">Due at pickup</dt>
          <dd className="text-right font-semibold">{formatCents(r.balanceDueCents)}</dd>
        </dl>
      </section>
      <p className="text-center">
        <Link href="/shop" className={secondaryButton}>
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
