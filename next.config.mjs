/** @type {import('next').NextConfig} */
const repoName = 'Site';

const nextConfig = {
  // Static export for GitHub Pages.
  output: 'export',

  // basePath: serves the site at https://<user>.github.io/Site/
  // Set BASE_PATH="" in CI to disable when serving from a custom domain.
  basePath: process.env.BASE_PATH || `/${repoName}`,

  // Static export requires unoptimized images.
  images: { unoptimized: true },

  // Trailing slash makes GitHub Pages routing work cleanly.
  trailingSlash: true,

  // Disable powered-by header.
  poweredByHeader: false,

  // Keep the build clean.
  reactStrictMode: true,
};

export default nextConfig;
