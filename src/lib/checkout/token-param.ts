/**
 * A URL query value as one string. `?t=a&t=b` reaches a page as an array, which would crash the
 * token hash with a 500; treating anything but a single string as "no token" makes it a 404
 * (audit A16). Lives outside service.ts so the receipt pages can use it.
 */
export function singleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
