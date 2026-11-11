import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

// Defaults (D51). Every storefront page is rendered per request (the layout is force-dynamic), so
// no incremental cache, tag cache or queue is configured. Add them here, with their bindings in
// wrangler.jsonc, if a page ever uses `revalidate`: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
