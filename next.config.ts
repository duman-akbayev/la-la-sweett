import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Canonical host: permanently redirect www.lalasweett.com -> lalasweett.com
  // so search engines index a single host and link signals don't get split.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lalasweett.com" }],
        destination: "https://lalasweett.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
