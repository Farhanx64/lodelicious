"use client";

import { useId, useMemo, useState, useTransition } from "react";

import { checkBasket } from "@/app/(frontend)/build-a-basket/actions";
import type { BuilderDisplay } from "@/src/lib/catalog/builder-data";
import {
  assessFeasibility,
  catalogOf,
  checkForPicker,
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

const GIFT_TYPE_OPTIONS: { value: GiftType; label: string; hint: string }[] = [
  { value: "sweet", label: "Sweet", hint: "Chocolates, fudge and candy" },
  { value: "savory", label: "Savory", hint: "Crackers, nuts and snacks" },
  { value: "sweet_savory", label: "Sweet & savory", hint: "A mix of both" },
  { value: "sympathy", label: "Sympathy", hint: "Premium chocolates and comforting treats" },
];

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
  const [size, setSize] = useState<SizeCode>("medium");
  const [budgetText, setBudgetText] = useState("");
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState("");
  const [serverResult, setServerResult] = useState<GiftValidation | { error: string } | null>(null);
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
  const premiumCap = result.premiumCap ?? 0;
  const premiumRemaining = premiumCap - result.totals.premiumCount;
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
          <p role="note" className="border border-[#e0c46c] bg-[#fff3cd] p-4 text-[#4a3b00]">
            Preview: stock hasn&rsquo;t been counted yet, so every item is shown as available for you to try the builder.
          </p>
        )}

        <fieldset>
          <legend className="mb-3 font-display text-2xl">1. What kind of gift?</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-3">
            {GIFT_TYPE_OPTIONS.map((o) => (
              <label key={o.value} className={`flex cursor-pointer gap-3 border p-4 ${giftType === o.value ? "border-ink bg-paper" : "border-line bg-paper/60"}`}>
                <input
                  type="radio"
                  name={`${ids}-type`}
                  value={o.value}
                  checked={giftType === o.value}
                  onChange={() => {
                    setGiftType(o.value);
                    setServerResult(null);
                  }}
                  className="mt-1 size-5 accent-ink"
                />
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="text-sm text-ink-soft">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-display text-2xl">2. Choose a size</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-3">
            {settings.sizes.map((s) => {
              const range = resolveCountRange(settings, s.code, giftType);
              const basketSize = resolveBasketSize(settings, s.code, giftType);
              return (
                <label key={s.code} className={`flex cursor-pointer gap-3 border p-4 ${size === s.code ? "border-ink bg-paper" : "border-line bg-paper/60"}`}>
                  <input
                    type="radio"
                    name={`${ids}-size`}
                    value={s.code}
                    checked={size === s.code}
                    onChange={() => {
                      setSize(s.code);
                      setServerResult(null);
                    }}
                    className="mt-1 size-5 accent-ink"
                  />
                  <span>
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-sm">
                      {range.min}–{range.max} items{basketSize ? ` · ${basketSize}" basket` : ""}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      Basket &amp; packaging {formatCents(s.packagingCents)} · up to {s.premiumCap} premium
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section aria-labelledby={`${ids}-budget-h`}>
          <h2 id={`${ids}-budget-h`} className="mb-2 font-display text-2xl">
            3. Your budget <span className="font-sans text-base text-ink-soft">(optional)</span>
          </h2>
          <p className="mb-3 max-w-[68ch]">{budgetNotice}</p>
          <label htmlFor={`${ids}-budget`} className="mb-1 block text-sm font-semibold">
            Budget in dollars
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true">$</span>
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
              className="min-h-11 w-40 border border-ink-soft bg-paper px-3"
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
          {!feasibility.feasible && (
            <div role="status" className="mt-3 border-l-4 border-gold bg-paper p-4">
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
          <h2 id={`${ids}-items-h`} className="mb-2 font-display text-2xl">
            4. Choose your items
          </h2>
          <p className="mb-3 text-sm text-ink-soft">
            One of each item, unless it&rsquo;s sold as an assortment. Premium items (Phillips Chocolate, Cape Cod Fudge, OMNIYA, Swiss chocolate) count toward your total.
          </p>
          <div role="group" aria-label="Filter items by category" className="mb-4 flex flex-wrap gap-2">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`min-h-11 border px-4 ${category === c ? "border-ink bg-ink text-cream" : "border-line bg-paper"}`}
              >
                {c || "All"}
              </button>
            ))}
          </div>
          {pickerItems.length === 0 ? (
            <p className="border border-line bg-paper p-4">No items in this category right now.</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-3">
              {pickerItems.map(({ d, product, status }) => {
                const quantity = chosen[d.id] ?? 0;
                return (
                  <li key={d.id} className={`flex flex-col border bg-paper ${quantity ? "border-ink" : "border-line"}`}>
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Payload's pre-sized thumbnail
                      <img src={d.imageUrl} alt={d.imageAlt} loading="lazy" className="aspect-[4/3] w-full bg-white object-contain" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-[#f1ebdd] text-sm text-ink-soft">Photo coming soon</div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-semibold leading-snug">{d.title}</p>
                      <p className="text-sm text-ink-soft">
                        {[d.brand, d.sizeLabel].filter(Boolean).join(" · ")}
                        {product.premium && <span className="ml-1 font-semibold text-gold-text">Premium</span>}
                      </p>
                      <p className="mt-auto pt-1">{product.priceCents !== null ? formatCents(product.priceCents) : ""}</p>
                      {!status.eligible && quantity === 0 && <p className="text-sm text-ink-soft">{status.message}</p>}
                      <div className="flex items-center gap-2 pt-1">
                        {quantity > 0 && (
                          <button type="button" onClick={() => change(d.id, -1)} className="min-h-11 flex-1 border border-ink px-3" aria-label={`Remove ${d.title}`}>
                            Remove
                          </button>
                        )}
                        {quantity > 0 && product.maxPerGift <= 1 ? (
                          <p className="flex min-h-11 flex-1 items-center justify-center text-sm font-semibold">
                            <span aria-hidden="true">✓&nbsp;</span>In your basket
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => change(d.id, 1)}
                            disabled={!status.eligible}
                            className="min-h-11 flex-1 bg-ink px-3 text-cream disabled:cursor-not-allowed disabled:bg-[#bdb6a8] disabled:text-ink"
                            aria-label={quantity > 0 ? `Add another ${d.title}` : `Add ${d.title}`}
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
          <h2 id={`${ids}-msg-h`} className="mb-3 font-display text-2xl">
            5. Message &amp; requests
          </h2>
          <label htmlFor={`${ids}-message`} className="mb-1 block text-sm font-semibold">
            Gift message (optional)
          </label>
          <textarea
            id={`${ids}-message`}
            value={message}
            maxLength={300}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            className="mb-1 w-full border border-ink-soft bg-paper p-3"
          />
          <p className="mb-4 text-sm text-ink-soft">{300 - message.length} characters left</p>
          <label htmlFor={`${ids}-requests`} className="mb-1 block text-sm font-semibold">
            Dietary needs or special requests (optional)
          </label>
          <textarea
            id={`${ids}-requests`}
            value={requests}
            maxLength={500}
            rows={3}
            onChange={(e) => setRequests(e.target.value)}
            aria-describedby={`${ids}-requests-note`}
            className="w-full border border-ink-soft bg-paper p-3"
          />
          <p id={`${ids}-requests-note`} className="mt-1 text-sm text-ink-soft">
            We do our best with requests, depending on what&rsquo;s in stock, and we&rsquo;ll contact you before making any significant change. We choose
            the ribbon and presentation to suit your gift.
          </p>
        </section>
      </div>

      <aside aria-labelledby={`${ids}-sum-h`} className="h-fit border border-line bg-paper p-5 lg:sticky lg:top-4">
        <h2 id={`${ids}-sum-h`} className="mb-3 font-display text-2xl">
          Your basket
        </h2>
        <p className="sr-only" aria-live="polite">
          {liveSummary}
        </p>
        <dl className="mb-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Items</dt>
          <dd className={result.totals.itemCount > result.countRange.max ? "font-semibold text-error" : ""}>
            {result.totals.itemCount} of {result.countRange.min}–{result.countRange.max}
          </dd>
          <dt>Premium items</dt>
          <dd className={result.totals.premiumCount > premiumCap ? "font-semibold text-error" : ""}>
            {result.totals.premiumCount} of {premiumCap}
          </dd>
          <dt>Contents</dt>
          <dd>{formatCents(result.totals.contentsCents)}</dd>
          <dt>Basket &amp; packaging</dt>
          <dd>{formatCents(result.totals.packagingCents)}</dd>
          <dt className="border-t border-line pt-1 font-semibold">Total</dt>
          <dd className="border-t border-line pt-1 font-semibold">{formatCents(result.totals.totalCents)}</dd>
          {result.totals.remainingBudgetCents !== null && (
            <>
              <dt>Budget left</dt>
              <dd className={result.totals.remainingBudgetCents < 0 ? "font-semibold text-error" : ""}>{formatCents(result.totals.remainingBudgetCents)}</dd>
            </>
          )}
        </dl>
        <p className="mb-4 text-sm text-ink-soft">Tax and delivery or shipping are added at checkout.</p>

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
          className="min-h-11 w-full bg-ink px-4 text-cream disabled:cursor-not-allowed disabled:bg-[#bdb6a8] disabled:text-ink"
        >
          {checking ? "Checking…" : "Review my basket"}
        </button>

        <div aria-live="polite">
          {serverResult && "error" in serverResult && <p className="mt-3 text-sm text-error">{serverResult.error}</p>}
          {serverResult && !("error" in serverResult) && serverResult.complete && (
            <p className="mt-3 border-l-4 border-gold bg-cream p-3 text-sm">
              Your basket checks out at <strong>{formatCents(serverResult.totals.totalCents)}</strong> before tax and delivery. Online checkout is coming
              soon — call <a href={phoneHref}>{phone}</a> and we&rsquo;ll make it for you.
            </p>
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
