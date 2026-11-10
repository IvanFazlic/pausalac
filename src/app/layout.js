import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// latin-ext covers Serbian Latin (č, ć, đ, š, ž).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata = {
  title: { default: "Paušalac", template: "%s · Paušalac" },
  description: "Invoicing for a paušalac: clients, invoices, recurring schedules and a client portal.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    // The font variables live on <html> so the theme's --font-sans / --font-mono
    // (defined on :root in globals.css) can resolve them.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
