"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { checkBasket, startReservation } from "@/app/(frontend)/build-a-basket/actions";
import { builderCards, type BuilderDisplay } from "@/src/lib/catalog/builder-cards";
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

import { BasketPreview3D, type PreviewItem } from "./BasketPreview3D";

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
  /** The option each multi-option card currently shows, by product id (first option until changed). */
  const [picked, setPicked] = useState<Record<string, string>>({});
  /** Phone only: the basket bar is compact until tapped. */
  const [expanded, setExpanded] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo(() => catalogOf(products), [products]);
  const displayById = useMemo(() => new Map(display.map((d) => [d.id, d])), [display]);
  // Only products tagged for the chosen gift type are offered (Products → Gift builder → Gift types).
  const inType = (id: string, type: GiftType) => catalog.get(id)?.giftTypes.includes(type) ?? false;
  const typeDisplay = useMemo(() => display.filter((d) => catalog.get(d.id)?.giftTypes.includes(giftType)), [display, catalog, giftType]);
  const categories = useMemo(() => [...new Set(typeDisplay.map((d) => d.categoryName).filter(Boolean))].sort(), [typeDisplay]);

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

  // One card per product: a product sold in options (dark or milk) is one card with a chooser.
  const cards = useMemo(() => builderCards(typeDisplay), [typeDisplay]);
  const pickerItems = cards
    .filter((card) => !category || card.options[0].categoryName === category)
    .map((card) => {
      const d = card.options.find((o) => o.id === picked[card.productId]) ?? card.options[0];
      const product = catalog.get(d.id)!;
      const status = checkForPicker(product, {
        settings,
        target: { kind: "custom", giftType },
        selectedQuantity: chosen[d.id] ?? 0,
        remainingBudgetCents: result.totals.remainingBudgetCents,
        premiumRemaining,
      });
      return { card, d, product, status };
    })
    // Items out of stock or over budget stay visible with the reason, after the ones that can be added.
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

  // On a phone the basket bar is pinned to the top of the screen. Keep focused controls clear of it
  // (WCAG 2.4.11): the page's top scroll padding follows the bar's height. The floating bag receipt
  // (D58) owns the bottom of the screen, so the bar never goes there.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const phone = window.matchMedia("(max-width: 47.99rem)");
    const root = document.documentElement;
    const sync = () => {
      root.style.scrollPaddingTop = phone.matches ? `${Math.ceil(stage.getBoundingClientRect().height) + 16}px` : "";
    };
    const ro = new ResizeObserver(sync);
    ro.observe(stage);
    phone.addEventListener("change", sync);
    // Working in the steps shrinks an enlarged basket back to the bar, so it never covers the controls.
    const shrink = (e: FocusEvent) => {
      if (!stage.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("focusin", shrink);
    sync();
    return () => {
      ro.disconnect();
      phone.removeEventListener("change", sync);
      document.removeEventListener("focusin", shrink);
      root.style.scrollPaddingTop = "";
    };
  }, []);

  const previewItems = useMemo<PreviewItem[]>(
    () =>
      Object.entries(chosen).map(([id, quantity]) => {
        const d = displayById.get(id);
        return { id, quantity, title: d?.title ?? "Item", categoryName: d?.categoryName, brand: d?.brand, premium: !!catalog.get(id)?.premium };
      }),
    [chosen, displayById, catalog],
  );

  const liveSummary =`${result.totals.itemCount} of ${result.countRange.min} to ${result.countRange.max} items. Total ${formatCents(result.totals.totalCents)}${
    result.totals.remainingBudgetCents !== null ? `, ${formatCents(result.totals.remainingBudgetCents)} of budget left` : ""
  }.`;

  const countLine = `${result.totals.itemCount} of ${result.countRange.min}–${result.countRange.max} items`;

  return (
    // Phone: one column, the basket pinned to the top as a compact bar, the summary after the steps.
    // Tablet and up: the steps on the left, the basket and summary in a sticky column on the right,
    // so the basket stays in view while the customer scrolls the picker (owner, 2026-11-22).
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)] lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="flex flex-col gap-10 md:col-start-1 md:row-start-1">
        {previewStock && (
          <p role="note" className="border border-gold bg-blush p-4 text-ink">
            Preview: stock hasn&rsquo;t been counted yet, so every item is shown as available for you to try the builder.
          </p>
        )}

        <fieldset>
          <legend className="mb-3 font-display text-2xl">1. What kind of gift?</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-3">
            {GIFT_TYPE_OPTIONS.map((o) => (
              <label key={o.value} className={`flex cursor-pointer gap-3 border p-4 ${giftType === o.value ? "border-gold-text bg-paper ring-1 ring-gold-text" : "border-gold bg-paper/60"}`}>
                <input
                  type="radio"
                  name={`${ids}-type`}
                  value={o.value}
                  checked={giftType === o.value}
                  onChange={() => {
                    setGiftType(o.value);
                    setServerResult(null);
                    // Drop picks that aren't part of the new type, and a category it doesn't have.
                    setChosen((current) => Object.fromEntries(Object.entries(current).filter(([id]) => inType(id, o.value))));
                    if (category && !display.some((d) => d.categoryName === category && inType(d.id, o.value))) setCategory("");
                  }}
                  className="mt-1 size-5 accent-gold-text"
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
            {sizes.map((s) => {
              const range = resolveCountRange(settings, s.code, giftType);
              const basketSize = resolveBasketSize(settings, s.code, giftType);
              return (
                <label key={s.code} className={`flex cursor-pointer gap-3 border p-4 ${size === s.code ? "border-gold-text bg-paper ring-1 ring-gold-text" : "border-gold bg-paper/60"}`}>
                  <input
                    type="radio"
                    name={`${ids}-size`}
                    value={s.code}
                    checked={size === s.code}
                    onChange={() => {
                      setSize(s.code);
                      setServerResult(null);
                    }}
                    className="mt-1 size-5 accent-gold-text"
                  />
                  <span>
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-sm">
                      {range.min}–{range.max} items{basketSize ? ` · ${basketSize}" basket` : ""}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      Basket &amp; packaging {formatCents(s.packagingCents)}{s.premiumCap !== null && ` · up to ${s.premiumCap} premium`}
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
            One of each item, unless it&rsquo;s sold as an assortment. Premium items (Phillips Chocolate, OMNIYA, Swiss chocolate) count toward your total.
          </p>
          <div role="group" aria-label="Filter items by category" className="mb-4 flex flex-wrap gap-2">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`min-h-11 border px-4 ${category === c ? "border-coastal-deep bg-coastal-deep text-cream" : "border-line bg-paper"}`}
              >
                {c || "All"}
              </button>
            ))}
          </div>
          {pickerItems.length === 0 ? (
            <p className="border border-line bg-paper p-4">
              {typeDisplay.length === 0 ? (
                <>
                  No items for this kind of gift right now. Call <a href={phoneHref}>{phone}</a> and we&rsquo;ll put one together.
                </>
              ) : (
                "No items in this category right now."
              )}
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-3 lg:grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))]">
              {pickerItems.map(({ card, d, product, status }) => {
                const quantity = chosen[d.id] ?? 0;
                const inBasket = card.options.filter((o) => chosen[o.id]);
                return (
                  <li key={card.productId} className={`flex flex-col border bg-paper p-1 ${inBasket.length ? "border-gold-text ring-1 ring-gold-text" : "border-gold"}`}>
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Payload's pre-sized thumbnail
                      <img src={d.imageUrl} alt={d.imageAlt} loading="lazy" className="aspect-[4/3] w-full bg-white object-contain" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-linen text-sm text-ink-soft">Photo coming soon</div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-semibold leading-snug">{card.title}</p>
                      <p className="text-sm text-ink-soft">
                        {[d.brand, d.sizeLabel].filter(Boolean).join(" · ")}
                        {product.premium && <span className="ml-1 font-semibold text-gold-text">Premium</span>}
                      </p>
                      {card.options.length > 1 && (
                        <>
                          <label htmlFor={`${ids}-opt-${card.productId}`} className="mt-1 text-sm font-semibold">
                            Option<span className="sr-only"> for {card.title}</span>
                          </label>
                          <select
                            id={`${ids}-opt-${card.productId}`}
                            value={d.id}
                            onChange={(e) => setPicked((current) => ({ ...current, [card.productId]: e.target.value }))}
                            className="min-h-11 w-full border border-ink-soft bg-paper px-2"
                          >
                            {card.options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.optionLabel ?? o.title}
                              </option>
                            ))}
                          </select>
                          {inBasket.length > 0 && (
                            <p className="text-sm">
                              In your basket: {inBasket.map((o) => `${o.optionLabel ?? o.title}${chosen[o.id] > 1 ? ` × ${chosen[o.id]}` : ""}`).join(", ")}
                            </p>
                          )}
                        </>
                      )}
                      <p className="mt-auto pt-1">{!product.priceApproved ? PRICE_TO_BE_CONFIRMED : product.priceCents !== null ? formatCents(product.priceCents) : ""}</p>
                      {!status.eligible && quantity === 0 && <p className="text-sm text-ink-soft">{status.message}</p>}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {quantity > 0 && (
                          <button type="button" onClick={() => change(d.id, -1)} className="min-h-11 flex-1 basis-24 whitespace-nowrap border border-gold-text px-3" aria-label={`Remove ${d.title}`}>
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
                            className="min-h-11 flex-1 basis-36 whitespace-nowrap bg-coastal-deep px-3 text-cream disabled:cursor-not-allowed disabled:bg-linen disabled:text-ink"
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

      {/* On a phone this wrapper dissolves (contents), so the basket bar can sit first and the summary last. */}
      <div className="contents md:col-start-2 md:row-start-1 md:sticky md:top-4 md:flex md:max-h-[calc(100dvh-2rem)] md:flex-col md:gap-4 md:self-start md:overflow-y-auto md:overscroll-contain">
      <div
        ref={stageRef}
        className="max-md:sticky max-md:top-0 max-md:z-30 max-md:order-first max-md:-mx-4 max-md:border-b max-md:border-gold max-md:bg-cream/95 max-md:px-4 max-md:pb-2 max-md:pt-[max(0.5rem,env(safe-area-inset-top))] max-md:shadow-sm max-md:backdrop-blur-sm"
      >
        <div className={`flex gap-3 md:flex-col md:items-stretch ${expanded ? "flex-col" : "items-center"}`}>
          <div
            onClick={() => {
              if (!expanded && window.matchMedia("(max-width: 47.99rem)").matches) setExpanded(true);
            }}
            className={`shrink-0 overflow-hidden rounded-lg md:h-[min(44vh,21rem)] md:w-full ${expanded ? "h-[min(46vh,20rem)] w-full" : "h-20 w-28"}`}
          >
            <BasketPreview3D items={previewItems} size={size} className="h-full w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p aria-hidden="true" className="leading-snug">
              {result.totals.itemCount === 0 ? (
                <span className="text-sm text-ink-soft">Add items and watch your basket fill</span>
              ) : (
                <>
                  <span className="block text-sm">{countLine}</span>
                  <span className="block font-semibold">{formatCents(result.totals.totalCents)}</span>
                </>
              )}
            </p>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
              className="min-h-11 min-w-11 max-w-full border border-gold-text bg-paper px-3 text-sm md:hidden"
            >
              {expanded ? "Smaller" : "Bigger"}
              <span className="sr-only"> basket picture</span>
            </button>
          </div>
        </div>
      </div>

      <aside aria-labelledby={`${ids}-sum-h`} className="h-fit border border-line bg-paper p-5">
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
          {premiumCap !== null && (
            <>
              <dt>Premium items</dt>
              <dd className={result.totals.premiumCount > premiumCap ? "font-semibold text-error" : ""}>
                {result.totals.premiumCount} of {premiumCap}
              </dd>
            </>
          )}
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
          className="min-h-11 w-full bg-coastal-deep px-4 text-cream disabled:cursor-not-allowed disabled:bg-linen disabled:text-ink"
        >
          {checking ? "Checking…" : "Review my basket"}
        </button>

        <div aria-live="polite">
          {serverResult && "error" in serverResult && <p className="mt-3 text-sm text-error">{serverResult.error}</p>}
          {serverResult && !("error" in serverResult) && serverResult.complete && (
            <div className="mt-3 border-l-4 border-gold bg-cream p-3 text-sm">
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
                className="min-h-11 w-full bg-coastal-deep px-4 text-cream disabled:cursor-not-allowed disabled:bg-linen disabled:text-ink"
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
    </div>
  );
}
