const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      supabaseHost
        ? { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }
        : { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The elder chat uses the microphone and (for the weather) the location, on our own pages only.
          { key: 'Permissions-Policy', value: 'microphone=(self), geolocation=(self), camera=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
