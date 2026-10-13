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
