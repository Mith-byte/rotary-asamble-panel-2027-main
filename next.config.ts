import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /*
    `next build` and `next dev` both write to .next by default, so building
    while the dev server is running overwrites the manifests it is serving —
    including the server-action manifest, which makes every form action fail
    with "An unexpected response was received from the server".

    `npm run build:check` sets NEXT_DIST_DIR so a verification build lands
    somewhere else and leaves a running dev server alone. Deploys are
    unaffected: `npm run build` still writes to .next.
  */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
