import type { Metadata } from "next";
import { siteOrigin } from "@/lib/business";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Bear Arms Armory | Corry, Pennsylvania",
  description:
    "Store news, community updates, and contact information for Bear Arms Armory at 740 E. Columbus Avenue in Corry, Pennsylvania.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Bear Arms Armory",
    title: "Bear Arms Armory | Corry, Pennsylvania",
    description:
      "Store news, community updates, and information for your visit.",
    url: "/",
    images: [
      {
        url: "/derived/bear-arms-logo.webp",
        width: 900,
        height: 916,
        alt: "Bear Arms Armory",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Bear Arms Armory",
    description: "Store news and visitor information in Corry, Pennsylvania.",
    images: ["/derived/bear-arms-logo.webp"],
  },
  robots:
    process.env.SITE_INDEXABLE === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  icons: { icon: "/derived/bear-arms-logo.webp" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
