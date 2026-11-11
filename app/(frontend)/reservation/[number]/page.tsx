import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { secondaryButton } from "@/components/checkout/styles";
import { findByToken } from "@/src/lib/checkout/service";
import { checkoutPayload } from "@/src/lib/checkout/session";
import { singleParam } from "@/src/lib/checkout/token-param";
import { formatCents } from "@/src/lib/money";
import { getStoreSettings } from "@/src/lib/store";
import { Accent } from "@/components/ui/Accent";

export const metadata: Metadata = { title: "Basket reserved", robots: { index: false } };

type Snapshot = { title: string; components: { productId: string; name: string; quantity: number }[]; message?: string; requests?: string };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const [{ payload }, store] = await Promise.all([checkoutPayload(), getStoreSettings()]);
  const r = await findByToken(payload, "reservations", number, singleParam(t));
  if (!r) notFound();
  const basket = r.basket as Snapshot;

  return (
    <div className="shell page max-w-[50rem]">
      <h1 className="mb-5 text-center">
        <Accent text="Basket reserved" />
      </h1>
      <p className="mb-6 text-center text-lg">
        Reservation <strong>{r.number}</strong>
      </p>
      {r.testMode && (
        <p role="note" className="mb-6 note">
          This was a <strong>test reservation</strong>: no money moved and it won&rsquo;t be prepared.
        </p>
      )}
      {r.reservationStatus === "staff_review" && (
        <p className="mb-6 note">We&rsquo;ll contact you to confirm your requests before we make your basket.</p>
      )}
      <section aria-labelledby="pickup" className="mb-6 panel">
        <h2 id="pickup" className="mb-2">
          Pickup
        </h2>
        <p>
          {r.pickup.label}
          <br />
          {store.name}, {store.street}, {store.locality}
        </p>
      </section>
      <section aria-labelledby="basket" className="mb-6 panel">
        <h2 id="basket" className="mb-2">
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
          <dt className="font-medium">Due at pickup</dt>
          <dd className="text-right font-medium">{formatCents(r.balanceDueCents)}</dd>
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
