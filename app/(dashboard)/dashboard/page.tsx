import config from "@payload-config";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { Dashboard3D } from "@/components/dashboard/Dashboard3D";
import { dashboardStats } from "@/src/lib/dashboard/stats";
import { formatCents } from "@/src/lib/money";

/** Staff dashboard (3D). Signed-in admin users only; everyone else goes to the admin login. */
export default async function DashboardPage() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) redirect("/admin/login?redirect=%2Fdashboard");

  const stats = await dashboardStats(payload);
  const tiles = [
    { label: "Sales, last 30 days", value: formatCents(stats.revenue30Cents) },
    { label: "Paid orders", value: String(stats.orders30) },
    { label: "Average order", value: formatCents(stats.averageCents) },
    { label: "To pack", value: String(stats.toPack) },
  ];

  return (
    <main className="mx-auto w-[min(100%-2rem,80rem)] py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-sm tracking-[0.2em] text-gold-text uppercase">Lodelicious</p>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight">Shop dashboard</h1>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Admin">
          {[
            ["Orders", "/admin/collections/orders"],
            ["Reservations", "/admin/collections/reservations"],
            ["Inquiries", "/admin/collections/inquiries"],
            ["Products", "/admin/collections/products"],
            ["Store details", "/admin/globals/store-settings"],
          ].map(([label, href], i) => (
            <Link
              key={href}
              className={i === 0 ? "rounded-full bg-coastal-deep px-4 py-2 text-white hover:opacity-90" : "rounded-full border border-gold bg-paper px-4 py-2 hover:bg-ivory"}
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p className="font-display text-3xl font-semibold">{t.value}</p>
          </div>
        ))}
      </section>

      <Dashboard3D stats={stats} />

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 font-display text-2xl">Best sellers</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-ink-soft">No paid orders in the last 30 days.</p>
          ) : (
            <ol className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
                  <span>
                    <span className="mr-2 text-gold-text">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="text-ink-soft">
                    {p.quantity} sold · {formatCents(p.revenueCents)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 font-display text-2xl">Orders by status</h2>
          <ul className="space-y-2">
            {stats.statuses.map((s) => (
              <li key={s.key} className="flex justify-between border-b border-line pb-2 last:border-0">
                <span>{s.label}</span>
                <span className="font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
