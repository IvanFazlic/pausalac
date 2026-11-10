/** @type {import('next').NextConfig} */
const nextConfig = {
  // The PDF renderer brings its own React reconciler; load it from
  // node_modules instead of bundling it into the server build.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Fonts are read from disk when a PDF is rendered, so they must be shipped
  // with the PDF route's serverless function.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./src/assets/fonts/*.ttf"],
  },

  // Keep the dev-only Next.js indicator away from the sidebar's account area.
  devIndicators: { position: "bottom-right" },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
