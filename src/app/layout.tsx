import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/i18n";
import SplashScreen from "@/components/SplashScreen";
import Toaster from "@/components/Toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Assetflow — Asset Management",
    template: "%s · Assetflow",
  },
  description:
    "IT asset management workspace with optical scanning, live inventory statistics and an append-only scan log.",
  icons: [
    { rel: "icon", url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { rel: "icon", url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { rel: "icon", url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    { rel: "icon", url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    { rel: "icon", url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon-120x120.png", sizes: "120x120" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon-144x144.png", sizes: "144x144" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon-152x152.png", sizes: "152x152" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  ],
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#ffffff",
};

const bootstrapScript = `try{var t=localStorage.getItem("af.theme");var dark=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var el=document.documentElement;el.dataset.theme=dark?"dark":"light";el.style.colorScheme=dark?"dark":"light";var l=localStorage.getItem("af.language");if(l==="fr"||l==="en"){el.lang=l;}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SplashScreen />
        <AppProvider>{children}</AppProvider>
        <Toaster />
      </body>
    </html>
  );
}
