import type { NextConfig } from 'next';
const nextConfig: NextConfig={poweredByHeader:false,images:{remotePatterns:[{protocol:'https',hostname:'images.unsplash.com'}]},experimental:{optimizePackageImports:['lucide-react']}};
export default nextConfig;