import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Long-running Node server (cPanel/Passenger). No edge/serverless.
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
