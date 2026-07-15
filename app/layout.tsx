import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flipper · Black Market",
  description: "City → Black Market flips (Europe)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${syne.variable} ${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden font-[family-name:var(--font-body)]">
        <div className="app-bg" aria-hidden />
        <div className="app-scroll">
          <Providers>
            <AppNav />
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
