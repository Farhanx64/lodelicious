import type { Field, FieldHook } from "payload";

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** URL slug, generated from `from` when left empty; editable in the sidebar. */
export function slugField(from: string): Field {
  const fill: FieldHook = ({ value, data }) => {
    if (typeof value === "string" && value.trim() !== "") return slugify(value);
    const source = data?.[from];
    return typeof source === "string" ? slugify(source) : value;
  };
  return {
    name: "slug",
    type: "text",
    unique: true,
    index: true,
    admin: { position: "sidebar", description: "Web address. Leave empty to generate from the name." },
    hooks: { beforeValidate: [fill] },
  };
}
