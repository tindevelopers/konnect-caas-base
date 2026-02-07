import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server external packages (moved from experimental in Next.js 16)
  serverExternalPackages: ['openai'],
  
  experimental: {
    optimizePackageImports: [
      "@tinadmin/core",
      "@tinadmin/ui-admin",
      "@heroicons/react",
      "apexcharts",
      "react-apexcharts",
      "@fullcalendar/react",
      "@fullcalendar/core",
      "@fullcalendar/daygrid",
      "@fullcalendar/timegrid",
      "@fullcalendar/list",
      "@fullcalendar/interaction",
      "simplebar-react",
      "swiper",
      "@builder.io/react",
    ],
  },
  
  // Skip static optimization for problematic pages during build
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // TypeScript configuration - don't fail build on type errors during dev
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Enable compression
  compress: true,
  
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    // Empty config to allow webpack config to work
    // Webpack config will be used when --webpack flag is passed
  },
  
  // Webpack configuration
  webpack(config, { isServer }) {
    // Handle SVG imports with SVGR - convert SVGs to React components
    // Find existing rule that handles SVG files
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg')
    );
    
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }
    
    // Add SVGR loader for SVG files - simple configuration
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: fileLoaderRule?.issuer,
      use: ['@svgr/webpack'],
    });
    
    // Optimize bundle size with aliases for better tree-shaking
    const path = require('path');
    const corePath = path.resolve(__dirname, '../../packages/@tinadmin/core/src');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/core': corePath,
      '@tinadmin/core': corePath,
      '@tinadmin/ui-admin': path.resolve(__dirname, '../../packages/@tinadmin/ui-admin/src'),
      '@tinadmin/config': path.resolve(__dirname, '../../packages/@tinadmin/config/src'),
    };
    
    // Ignore optional dependencies that are loaded dynamically
    // These are loaded with require() at runtime if available
    config.plugins = config.plugins || [];
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@aws-sdk\/client-ses$/,
        contextRegExp: /packages\/@tinadmin\/core\/src\/email\/providers/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^nodemailer$/,
        contextRegExp: /packages\/@tinadmin\/core\/src\/email\/providers/,
      })
    );
    
    // Optimize bundle size
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    return config;
  },
  
  // Headers for security and caching
  async headers() {
    return [
      {
        // Security headers for all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Cache headers for static assets
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
