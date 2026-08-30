import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    poweredByHeader: false,
    compress: true,
    productionBrowserSourceMaps: false,
    // Tiny static assets — skip the Sharp image optimizer process on a 1 GB VPS.
    images: { unoptimized: true },
    compiler: {
        removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
    },
    experimental: {
        optimizePackageImports: ["recharts", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        ...(process.env.NODE_ENV === "production"
            ? { webpackMemoryOptimizations: true, cpus: 1 }
            : {}),
    },
};

export default nextConfig;
