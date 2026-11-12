"use client";

import { FieldDescription, FieldLabel, useAuth, useConfig, useField } from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { HexColorPicker } from "react-colorful";

import {
  BRAND_COLOR_DEFAULT,
  BUTTON_COLOR_DEFAULT,
  DARK_TEXT,
  LIGHT_TEXT,
  contrast,
  validateBrandColor,
  validateButtonColor,
} from "@/src/lib/brand-color";
import { COLOR_FORMATS, type ColorFormat, formatColor, parseColor } from "@/src/lib/color-format";
import { MAX_SAVED_COLORS, PALETTE_PRESETS, normalizeSavedColors } from "@/src/lib/color-palette";

import "./ColorPickerField.css";

/**
 * Colour picker for the Brand and Button colours on Store details (D55): saturation/brightness
 * square, hue slider, eyedropper, Hex/RGB/HSL entry and the shop's saved swatches. The value is
 * still stored as `#rrggbb` and checked by `src/lib/brand-color.ts`; the result of that check
 * shows under the picker as staff pick, before saving. No alpha: the colours must stay opaque.
 */
type Kind = "brand" | "button";

const KINDS = {
  brand: { fallback: BRAND_COLOR_DEFAULT, text: LIGHT_TEXT, textName: "white text", validate: validateBrandColor },
  button: { fallback: BUTTON_COLOR_DEFAULT, text: DARK_TEXT, textName: "dark text", validate: validateButtonColor },
} as const;

// ---------- Saved colours, shared by every picker on the page and kept in the Colour palette global ----------

type SavedState = { colors: string[]; status: "idle" | "loading" | "ready" | "error"; message?: string };
let saved: SavedState = { colors: [], status: "idle" };
const listeners = new Set<() => void>();
const setSaved = (next: SavedState) => {
  saved = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function useSavedColors(apiBase: string) {
  const state = useSyncExternalStore(subscribe, () => saved, () => saved);
  const url = `${apiBase}/globals/color-palette`;

  useEffect(() => {
    if (saved.status !== "idle") return;
    setSaved({ ...saved, status: "loading" });
    fetch(`${url}?depth=0`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: { colors?: unknown }) => setSaved({ colors: normalizeSavedColors(doc.colors), status: "ready" }))
      .catch(() => setSaved({ colors: [], status: "error", message: "Couldn't load the saved colours." }));
  }, [url]);

  const save = useCallback(
    async (colors: string[]) => {
      const previous = saved.colors;
      setSaved({ colors, status: "ready" });
      try {
        const r = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colors }),
        });
        if (!r.ok) throw new Error(String(r.status));
      } catch {
        setSaved({ colors: previous, status: "ready", message: "Couldn't save that change to the saved colours. Try again." });
      }
    },
    [url],
  );

  return { ...state, save };
}

// ---------- The field ----------

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const getEyeDropper = () => (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null;
const noSubscribe = () => () => {};

export const ColorPickerField: TextFieldClientComponent = (props) => {
  const { field, path: pathFromProps, readOnly: readOnlyProp } = props;
  const kind: Kind = (props as { kind?: Kind }).kind === "button" ? "button" : "brand";
  const spec = KINDS[kind];
  const { label, required, admin } = field;
  const description = admin?.description;
  const readOnly = Boolean(readOnlyProp || admin?.readOnly);

  const { value, setValue, path, showError, disabled } = useField<string | null>({
    potentiallyStalePath: pathFromProps,
    validate: (v: unknown) => spec.validate(v),
  });
  const locked = readOnly || disabled;

  const { config } = useConfig();
  const apiBase = `${config.serverURL ?? ""}${config.routes.api}`;
  const { permissions } = useAuth();
  const canEditSaved = Boolean(permissions?.globals?.["color-palette"]?.update);
  const { colors: custom, status, message: savedMessage, save } = useSavedColors(apiBase);

  const id = useId();
  const inputId = `field-${path.replace(/\./g, "__")}`;
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [draft, setDraft] = useState<string | null>(null);
  // The browser's EyeDropper (Chrome and Edge on desktop); the button is hidden where it's missing.
  const eyeDropper = useSyncExternalStore(noSubscribe, getEyeDropper, () => null);

  const stored = typeof value === "string" ? value.trim().toLowerCase() : "";
  const storedHex = /^#[0-9a-f]{6}$/.test(stored) ? stored : null;
  const shown = storedHex ?? spec.fallback;
  const text = draft ?? (stored ? (storedHex ? formatColor(storedHex, format) : stored) : "");
  const typedInvalid = draft !== null && draft.trim() !== "" && parseColor(draft, format) === null;

  const pick = useCallback(
    (hex: string) => {
      if (locked) return;
      setDraft(null);
      setValue(hex.toLowerCase());
    },
    [locked, setValue],
  );

  const onType = (next: string) => {
    setDraft(next);
    if (next.trim() === "") return setValue("");
    const hex = parseColor(next, format);
    if (hex) setValue(hex);
  };

  const onBlur = () => {
    if (draft !== null && !typedInvalid) setDraft(null);
  };

  const pickFromScreen = async () => {
    if (!eyeDropper) return;
    try {
      const { sRGBHex } = await new eyeDropper().open();
      const hex = parseColor(sRGBHex);
      if (hex) pick(hex);
    } catch {
      // Escape cancels the eyedropper; nothing to do.
    }
  };

  // The live check: the same rule the server applies on save.
  const verdict = spec.validate(stored || null);
  const ratio = contrast(shown, spec.text);
  const swatches = useMemo(
    () => [
      ...PALETTE_PRESETS.map((p) => ({ hex: p.hex, name: p.name, preset: true })),
      ...custom.filter((hex) => !PALETTE_PRESETS.some((p) => p.hex === hex)).map((hex) => ({ hex, name: "Saved colour", preset: false })),
    ],
    [custom],
  );
  const isCustom = custom.includes(shown);
  const isPreset = PALETTE_PRESETS.some((p) => p.hex === shown);

  const panelId = `${id}-panel`;
  const messageId = `${id}-message`;
  const labelText = typeof label === "string" ? label : path;

  return (
    <div className={["field-type", "text", "lp-color", showError && "error", locked && "read-only"].filter(Boolean).join(" ")}>
      <FieldLabel htmlFor={inputId} label={label} path={path} required={required} />
      <div className="field-type__wrap">
        <div className="lp-color__row">
          <button
            type="button"
            className="lp-color__swatch"
            style={{ background: shown }}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Hide" : "Show"} the colour picker for ${labelText}`}
            onClick={() => setOpen((o) => !o)}
            disabled={locked}
          >
            <span aria-hidden="true" style={{ color: spec.text }}>
              Aa
            </span>
          </button>
          <label className="lp-visually-hidden" htmlFor={`${id}-format`}>
            Colour format
          </label>
          <select id={`${id}-format`} className="lp-color__format" value={format} onChange={(e) => (setFormat(e.target.value as ColorFormat), setDraft(null))} disabled={locked}>
            {COLOR_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            id={inputId}
            name={path}
            type="text"
            className="lp-color__input"
            value={text}
            placeholder={formatColor(spec.fallback, format)}
            onChange={(e) => onType(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onBlur())}
            readOnly={locked}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={typedInvalid || verdict !== true}
            aria-describedby={messageId}
          />
        </div>

        {open && (
          <div id={panelId} className="lp-color__panel" role="group" aria-label={`Colour picker for ${labelText}`}>
            <HexColorPicker color={shown} onChange={pick} className="lp-color__picker" />
            <div className="lp-color__tools">
              <div className="lp-color__preview" style={{ background: shown, color: spec.text }} aria-hidden="true">
                Shop sweets
              </div>
              {eyeDropper && (
                <button type="button" className="lp-color__btn" onClick={pickFromScreen}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2 22 1-1h3l9-9M3 21v-3l9-9m3 6 3.4-3.4a2.1 2.1 0 1 0-3-3L12 9l6 6Zm-6.5-3.5 7 7"
                    />
                  </svg>
                  Pick from screen
                </button>
              )}
            </div>

            <div className="lp-color__saved">
              <div className="lp-color__saved-head">
                <span id={`${id}-saved`}>Saved</span>
                {canEditSaved && (
                  <span className="lp-color__saved-actions">
                    {isCustom && (
                      <button type="button" className="lp-color__link" onClick={() => save(custom.filter((c) => c !== shown))}>
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      className="lp-color__link"
                      onClick={() => save([...custom, shown])}
                      disabled={isCustom || isPreset || status === "loading" || custom.length >= MAX_SAVED_COLORS}
                      title={isCustom || isPreset ? `${shown} is already saved` : `Save ${shown} for later`}
                    >
                      + Add
                    </button>
                  </span>
                )}
              </div>
              <ul className="lp-color__swatches" aria-labelledby={`${id}-saved`}>
                {swatches.map((s) => {
                  const ok = spec.validate(s.hex) === true;
                  return (
                    <li key={s.hex}>
                      <button
                        type="button"
                        className={["lp-color__chip", !ok && "lp-color__chip--fails"].filter(Boolean).join(" ")}
                        style={{ background: s.hex }}
                        aria-pressed={s.hex === shown}
                        aria-label={`${s.name} ${s.hex}${ok ? "" : `, too ${kind === "brand" ? "light" : "dark"} for ${spec.textName}`}`}
                        title={`${s.name} ${s.hex}${ok ? "" : ` (too ${kind === "brand" ? "light" : "dark"} for ${spec.textName})`}`}
                        onClick={() => pick(s.hex)}
                      />
                    </li>
                  );
                })}
              </ul>
              {savedMessage && <p className="lp-color__note">{savedMessage}</p>}
            </div>
          </div>
        )}

        <div id={messageId} className="lp-color__message" role={showError ? "alert" : "status"} aria-live="polite">
          {typedInvalid ? (
            <p className="lp-color__bad">Not a colour this box understands. Try #9c4459, rgb(156, 68, 89) or hsl(346, 39%, 44%).</p>
          ) : verdict !== true ? (
            <p className="lp-color__bad">
              {storedHex ? (
                <>
                  <strong>
                    Too {kind === "brand" ? "light" : "dark"} for {spec.textName}:
                  </strong>{" "}
                  {ratio.toFixed(1)}:1, and it needs at least 4.5:1. Pick a {kind === "brand" ? "deeper" : "lighter"} shade.
                </>
              ) : (
                verdict
              )}
            </p>
          ) : (
            <p className="lp-color__good">
              {spec.textName[0].toUpperCase() + spec.textName.slice(1)} on it: {ratio.toFixed(1)}:1 (needs 4.5:1). {stored ? "" : "Using the default."}
            </p>
          )}
        </div>
        <FieldDescription description={description} path={path} />
      </div>
    </div>
  );
};
