import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import { loadBuilderCatalogFrom, type BuilderCatalog } from "./builder-catalog";

export type { BuilderCatalog, BuilderDisplay } from "./builder-catalog";

export async function loadBuilderCatalog(): Promise<BuilderCatalog> {
  return loadBuilderCatalogFrom(await getPayload({ config }));
}
