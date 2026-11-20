import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

import { isPreviewEnv } from "./src/lib/app-env";
import { securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  // Built for one of two hosts (D51): Cloudflare Workers through OpenNext (`npm run cf:build`,
  // DEPLOY_TARGET=cloudflare) or a plain Node server (the default: local development and tests).
  // Inlined so each build drops the other host's database, storage and image packages.
  env: { DEPLOY_TARGET: process.env.DEPLOY_TARGET === "cloudflare" ? "cloudflare" : "node" },
  // No "X-Powered-By" header (withPayload adds its own unless this is false).
  poweredByHeader: false,
  // Evaluated at build time (D41): HSTS only for a production build (APP_ENV not local, staging or test).
  headers: async () => securityHeaders({ hsts: process.env.NODE_ENV === "production" && !isPreviewEnv() }),
  // One canonical host for search (D68): www. and plain http:// go to https://shoplodelicious.com.
  // Only on the live domain, so local, tunnel and staging hosts are untouched.
  redirects: async () => [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.shoplodelicious.com" }],
      destination: "https://shoplodelicious.com/:path*",
      permanent: true,
    },
    {
      source: "/:path*",
      has: [
        { type: "host", value: "shoplodelicious.com" },
        { type: "header", key: "x-forwarded-proto", value: "http" },
      ],
      destination: "https://shoplodelicious.com/:path*",
      permanent: true,
    },
  ],
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
