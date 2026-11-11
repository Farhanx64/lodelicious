"use client";

import { useId, useMemo, useState, useTransition } from "react";

import { checkBasket, startReservation } from "@/app/(frontend)/build-a-basket/actions";
import type { BuilderDisplay } from "@/src/lib/catalog/builder-data";
import { PRICE_TO_BE_CONFIRMED } from "@/src/lib/catalog/product";
import {
  assessFeasibility,
  catalogOf,
  checkForPicker,
  offeredSizes,
  resolveBasketSize,
  resolveCountRange,
  validateGift,
  type BuilderProduct,
  type GiftSettings,
  type GiftType,
  type GiftValidation,
  type SizeCode,
} from "@/src/lib/gifts";
import { formatCents, parseCents } from "@/src/lib/money";

import { field, primaryButton, secondaryButton } from "@/components/checkout/styles";

const GIFT_TYPE_OPTIONS: { value: GiftType; label: string; hint: string }[] = [
  { value: "sweet", label: "Sweet", hint: "Chocolates, fudge and candy" },
  { value: "savory", label: "Savory", hint: "Crackers, nuts and snacks" },
  { value: "sweet_savory", label: "Sweet & savory", hint: "A mix of both" },
  { value: "sympathy", label: "Sympathy", hint: "Premium chocolates and comforting treats" },
];

function StepHeading({ n, id, children, note }: { n: number; id?: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-4 border-t border-line pt-6">
      <span aria-hidden="true" className="label-caps shrink-0 text-rose-deep">
        {String(n).padStart(2, "0")}
      </span>
      <h2 id={id}>
        {children}
        {note && <span className="label-caps ml-3 align-middle text-muted">{note}</span>}
      </h2>
    </div>
  );
}

const cardBase = "flex cursor-pointer gap-3 rounded-2xl border p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";
const cardOn = "border-cocoa bg-clay ring-1 ring-rose-deep";
const cardOff = "border-muted/50 bg-transparent hover:border-cocoa";

type Props = {
  settings: GiftSettings;
  products: BuilderProduct[];
  display: BuilderDisplay[];
  budgetNotice: string;
  previewStock: boolean;
  phone: string;
  phoneHref: string;
};

export function BasketBuilder({ settings, products, display, budgetNotice, previewStock, phone, phoneHref }: Props) {
  const ids = useId();
  const [giftType, setGiftType] = useState<GiftType>("sweet");
  const sizes = offeredSizes(settings);
  const [size, setSize] = useState<SizeCode>(() => (sizes.find((s) => s.code === "medium") ?? sizes[0]).code);
  const [budgetText, setBudgetText] = useState("");
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState("");
  const [serverResult, setServerResult] = useState<GiftValidation | { error: string } | null>(null);
  const [reserving, startReserve] = useTransition();
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  const catalog = useMemo(() => catalogOf(products), [products]);
  const displayById = useMemo(() => new Map(display.map((d) => [d.id, d])), [display]);
  const categories = useMemo(() => [...new Set(display.map((d) => d.categoryName).filter(Boolean))].sort(), [display]);

  let budgetCents: number | null = null;
  let budgetError: string | null = null;
  if (budgetText.trim() !== "") {
    try {
      budgetCents = parseCents(budgetText);
      if (budgetCents <= 0) throw new RangeError();
    } catch {
      budgetCents = null;
      budgetError = "Enter a budget in dollars, like 100 or 100.00.";
    }
  }

  const selections = Object.entries(chosen).map(([productId, quantity]) => ({ productId, quantity }));
  const request = { kind: "custom" as const, size, giftType, budgetCents, selections };
  const result = validateGift(request, settings, catalog);
  const feasibility = assessFeasibility(settings, size, giftType, budgetCents, products);
  const premiumCap = result.premiumCap;
  const premiumRemaining = premiumCap === null ? null : premiumCap - result.totals.premiumCount;
  const blocking = result.violations.filter((v) => v.code !== "COUNT_BELOW_MIN");

  const pickerItems = display
    .filter((d) => !category || d.categoryName === category)
    .map((d) => {
      const product = catalog.get(d.id)!;
      const status = checkForPicker(product, {
        settings,
        target: { kind: "custom", giftType },
        selectedQuantity: chosen[d.id] ?? 0,
        remainingBudgetCents: result.totals.remainingBudgetCents,
        premiumRemaining,
      });
      return { d, product, status };
    })
    // Products that can never be in this gift type go last; nothing is hidden silently.
    .sort((a, b) => Number(!a.status.eligible) - Number(!b.status.eligible));

  function change(id: string, delta: number) {
    setServerResult(null);
    setChosen((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) + delta;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }

  const liveSummary = `${result.totals.itemCount} of ${result.countRange.min} to ${result.countRange.max} items. Total ${formatCents(result.totals.totalCents)}${
    result.totals.remainingBudgetCents !== null ? `, ${formatCents(result.totals.remainingBudgetCents)} of budget left` : ""
  }.`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-10">
        {previewStock && (
          <p role="note" className="note text-sm">
            Preview: stock hasn&rsquo;t been counted yet, so every item is shown as available for you to try the builder.
          </p>
        )}

        <fieldset>
          <legend className="w-full"><StepHeading n={1}>What kind of gift?</StepHeading></legend>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {GIFT_TYPE_OPTIONS.map((o) => (
              <label key={o.value} className={`${cardBase} ${giftType === o.value ? cardOn : cardOff}`}>
                <input
                  type="radio"
                  name={`${ids}-type`}
                  value={o.value}
                  checked={giftType === o.value}
                  onChange={() => {
                    setGiftType(o.value);
                    setServerResult(null);
                  }}
                  className="mt-1 size-5 shrink-0 accent-rose-deep"
                />
                <span>
                  <span className="block font-medium">{o.label}</span>
                  <span className="text-sm text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="w-full"><StepHeading n={2}>Choose a size</StepHeading></legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {sizes.map((s) => {
              const range = resolveCountRange(settings, s.code, giftType);
              const basketSize = resolveBasketSize(settings, s.code, giftType);
              return (
                <label key={s.code} className={`${cardBase} ${size === s.code ? cardOn : cardOff}`}>
                  <input
                    type="radio"
                    name={`${ids}-size`}
                    value={s.code}
                    checked={size === s.code}
                    onChange={() => {
                      setSize(s.code);
                      setServerResult(null);
                    }}
                    className="mt-1 size-5 shrink-0 accent-rose-deep"
                  />
                  <span>
                    <span className="block text-lg font-medium">{s.label}</span>
                    <span className="block text-sm">
                      {range.min}–{range.max} items{basketSize ? ` · ${basketSize}" basket` : ""}
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {formatCents(s.packagingCents)} basket &amp; packaging
                      {s.premiumCap !== null && (
                        <>
                          <br />
                          Up to {s.premiumCap} premium
                        </>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section aria-labelledby={`${ids}-budget-h`}>
          <StepHeading n={3} id={`${ids}-budget-h`} note="(optional)">
            Your budget
          </StepHeading>
          <p className="mb-3 max-w-[68ch] text-muted">{budgetNotice}</p>
          <label htmlFor={`${ids}-budget`} className="label-caps mb-2 block">
            Budget in dollars
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-lg">$</span>
            <input
              id={`${ids}-budget`}
              inputMode="decimal"
              autoComplete="off"
              value={budgetText}
              onChange={(e) => {
                setBudgetText(e.target.value);
                setServerResult(null);
              }}
              aria-invalid={budgetError ? true : undefined}
              aria-describedby={budgetError ? `${ids}-budget-err` : undefined}
              className={`${field} w-40`}
            />
          </div>
          {budgetError && (
            <p id={`${ids}-budget-err`} className="mt-1 text-error">
              {budgetError}
            </p>
          )}
          {budgetCents !== null && (
            <p className="mt-2 text-sm">
              {formatCents(budgetCents)} − {formatCents(result.totals.packagingCents)} basket &amp; packaging ={" "}
              <strong>{formatCents(Math.max(0, budgetCents - result.totals.packagingCents))}</strong> for contents.
            </p>
          )}
          {budgetCents !== null && !feasibility.feasible && (
            <div role="status" className="mt-3 note">
              {feasibility.minimumBudgetCents === null ? (
                <p>Not enough items are available right now to complete this size. Try a smaller size, or call us and we&rsquo;ll put one together.</p>
              ) : (
                <p>
                  With what&rsquo;s available today, this basket needs a budget of at least{" "}
                  <strong>{formatCents(feasibility.minimumBudgetCents)}</strong>.
                </p>
              )}
              {feasibility.smallerSizesThatFit.length > 0 && (
                <p className="mt-2">
                  A smaller size that fits:{" "}
                  {feasibility.smallerSizesThatFit
                    .map((code) => settings.sizes.find((s) => s.code === code)?.label ?? code)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby={`${ids}-items-h`}>
          <StepHeading n={4} id={`${ids}-items-h`}>
            Choose your items
          </StepHeading>
          <p className="mb-3 text-sm text-muted">
            One of each item, unless it&rsquo;s sold as an assortment. Premium items (Phillips Chocolate, Cape Cod Fudge, OMNIYA, Swiss chocolate) count toward your total.
          </p>
          <div role="group" aria-label="Filter items by category" className="mb-4 flex flex-wrap gap-2">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`label-caps min-h-11 rounded-full border px-5 ${category === c ? "border-rose-deep bg-rose-deep text-on-rose" : "border-muted/50 bg-transparent hover:border-cocoa"}`}
              >
                {c || "All"}
              </button>
            ))}
          </div>
          {pickerItems.length === 0 ? (
            <p className="note">No items in this category right now.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {pickerItems.map(({ d, product, status }) => {
                const quantity = chosen[d.id] ?? 0;
                return (
                  <li key={d.id} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-clay ${quantity ? "border-cocoa ring-1 ring-rose-deep" : "border-transparent"}`}>
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Payload's pre-sized thumbnail
                      <img src={d.imageUrl} alt={d.imageAlt} loading="lazy" className="aspect-[4/3] w-full object-contain p-2 mix-blend-multiply" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-clay text-sm text-muted">Photo coming soon</div>
                    )}
                    {quantity > 0 && (
                      <span aria-hidden="true" className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-rose-deep text-sm text-on-rose">
                        {quantity > 1 ? quantity : "✓"}
                      </span>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-medium leading-snug">{d.title}</p>
                      <p className="text-sm text-muted">
                        {[d.brand, d.sizeLabel].filter(Boolean).join(" · ")}
                        {product.premium && <span className="ml-1 font-medium text-rose-deep">Premium</span>}
                      </p>
                      <p className="mt-auto pt-1">{!product.priceApproved ? PRICE_TO_BE_CONFIRMED : product.priceCents !== null ? formatCents(product.priceCents) : ""}</p>
                      {!status.eligible && quantity === 0 && <p className="text-sm text-muted">{status.message}</p>}
                      <div className="flex items-center gap-2 pt-1">
                        {quantity > 0 && (
                          <button type="button" onClick={() => change(d.id, -1)} className={`${secondaryButton} min-h-11! flex-1 px-3!`} aria-label={`Remove ${d.title}`}>
                            Remove
                          </button>
                        )}
                        {quantity > 0 && product.maxPerGift <= 1 ? (
                          <p className="flex min-h-11 flex-1 items-center justify-center text-sm font-medium">
                            <span aria-hidden="true">✓&nbsp;</span>In your basket
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => change(d.id, 1)}
                            disabled={!status.eligible}
                            className={`${primaryButton} min-h-11! flex-1 px-3! disabled:border disabled:border-muted/50`}
                            aria-label={quantity > 0 ? `Add another (${quantity}) ${d.title}` : `Add ${d.title}`}
                          >
                            {quantity > 0 ? `Add another (${quantity})` : "Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby={`${ids}-msg-h`}>
          <StepHeading n={5} id={`${ids}-msg-h`}>
            Message &amp; requests
          </StepHeading>
          <label htmlFor={`${ids}-message`} className="label-caps mb-2 block">
            Gift message (optional)
          </label>
          <textarea
            id={`${ids}-message`}
            value={message}
            maxLength={300}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            className={`${field} mb-1`}
          />
          <p className="mb-4 text-sm text-muted">{300 - message.length} characters left</p>
          <label htmlFor={`${ids}-requests`} className="label-caps mb-2 block">
            Dietary needs or special requests (optional)
          </label>
          <textarea
            id={`${ids}-requests`}
            value={requests}
            maxLength={500}
            rows={3}
            onChange={(e) => setRequests(e.target.value)}
            aria-describedby={`${ids}-requests-note`}
            className={field}
          />
          <p id={`${ids}-requests-note`} className="mt-1 text-sm text-muted">
            We do our best with requests, depending on what&rsquo;s in stock, and we&rsquo;ll contact you before making any significant change. We choose
            the ribbon and presentation to suit your gift.
          </p>
        </section>
      </div>

      <aside aria-labelledby={`${ids}-sum-h`} className="panel h-fit lg:sticky lg:top-28">
        <h2 id={`${ids}-sum-h`} className="mb-4">
          Your basket
        </h2>
        <p className="sr-only" aria-live="polite">
          {liveSummary}
        </p>
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-sm font-medium">
            <span>Items</span>
            <span className={result.totals.itemCount > result.countRange.max ? "text-error" : ""}>
              {result.totals.itemCount} of {result.countRange.min}–{result.countRange.max}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-clay">
            <div
              className={`h-full rounded-full ${result.totals.itemCount >= result.countRange.min ? "bg-rose-deep" : "bg-rose-deep"}`}
              style={{ width: `${Math.min(100, (result.totals.itemCount / Math.max(1, result.countRange.max)) * 100)}%` }}
            />
          </div>
        </div>
        <dl className="mb-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt className="sr-only">Items</dt>
          <dd className="sr-only">
            {result.totals.itemCount} of {result.countRange.min}–{result.countRange.max}
          </dd>
          {premiumCap !== null && (
            <>
              <dt>Premium items</dt>
              <dd className={result.totals.premiumCount > premiumCap ? "font-medium text-error" : ""}>
                {result.totals.premiumCount} of {premiumCap}
              </dd>
            </>
          )}
          <dt>Contents</dt>
          <dd>{formatCents(result.totals.contentsCents)}</dd>
          <dt>Basket &amp; packaging</dt>
          <dd>{formatCents(result.totals.packagingCents)}</dd>
          <dt className="mt-2 border-t border-cocoa/15 pt-3 font-display text-2xl leading-none font-normal">Total</dt>
          <dd className="mt-2 border-t border-cocoa/15 pt-3 text-right font-display text-2xl leading-none">{formatCents(result.totals.totalCents)}</dd>
          {result.totals.remainingBudgetCents !== null && (
            <>
              <dt>Budget left</dt>
              <dd className={result.totals.remainingBudgetCents < 0 ? "font-medium text-error" : ""}>{formatCents(result.totals.remainingBudgetCents)}</dd>
            </>
          )}
        </dl>
        <p className="mb-4 text-sm text-muted">Tax and delivery or shipping are added at checkout.</p>

        {selections.length > 0 && (
          <ul className="mb-4 divide-y divide-line border-y border-line text-sm">
            {selections.map((s) => {
              const d = displayById.get(s.productId);
              return (
                <li key={s.productId} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {d?.title ?? "Item"}
                    {s.quantity > 1 ? ` × ${s.quantity}` : ""}
                  </span>
                  <button type="button" onClick={() => change(s.productId, -s.quantity)} className="min-h-11 shrink-0 underline" aria-label={`Remove ${d?.title ?? "item"} from basket`}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {blocking.length > 0 && (
          <ul role="alert" className="mb-4 flex flex-col gap-1 text-sm text-error">
            {blocking.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
        )}
        {!result.complete && blocking.length === 0 && (
          <p className="mb-4 text-sm">{result.violations.find((v) => v.code === "COUNT_BELOW_MIN")?.message ?? "Add items to start your basket."}</p>
        )}

        <button
          type="button"
          disabled={!result.complete || checking}
          onClick={() => startCheck(async () => setServerResult(await checkBasket(request)))}
          className={`${primaryButton} w-full disabled:border disabled:border-muted/50`}
        >
          {checking ? "Checking…" : "Review my basket"}
        </button>

        <div aria-live="polite">
          {serverResult && "error" in serverResult && <p className="mt-3 text-sm text-error">{serverResult.error}</p>}
          {serverResult && !("error" in serverResult) && serverResult.complete && (
            <div className="mt-4 rounded-2xl bg-cream p-4 text-sm">
              <p className="mb-3">
                Your basket checks out at <strong>{formatCents(serverResult.totals.totalCents)}</strong> before tax. Baskets are made to order: reserve
                yours with a deposit and pay the rest at pickup. Questions? Call <a href={phoneHref}>{phone}</a>.
              </p>
              <button
                type="button"
                disabled={reserving}
                onClick={() =>
                  startReserve(async () => {
                    const r = await startReservation({ request, message, requests });
                    if (r?.error) setReserveError(r.error);
                  })
                }
                className={`${primaryButton} w-full`}
              >
                {reserving ? "One moment…" : "Reserve this basket"}
              </button>
              {reserveError && (
                <p role="alert" className="mt-2 text-error">
                  {reserveError}
                </p>
              )}
            </div>
          )}
          {serverResult && !("error" in serverResult) && !serverResult.complete && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-error">
              {serverResult.violations.map((v, i) => (
                <li key={i}>{v.message}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
