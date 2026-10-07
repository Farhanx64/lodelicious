import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

import { isPreviewEnv } from "./src/lib/app-env";
import { securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  // Long-running Node server (cPanel/Passenger). No edge/serverless.
  // No "X-Powered-By" header (withPayload adds its own unless this is false).
  poweredByHeader: false,
  // Evaluated at build time (D41): HSTS only for a production build (APP_ENV not local, staging or test).
  headers: async () => securityHeaders({ hsts: process.env.NODE_ENV === "production" && !isPreviewEnv() }),
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
