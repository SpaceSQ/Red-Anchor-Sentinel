import type { Metadata, Viewport } from "next";
import { Oswald, Share_Tech_Mono } from "next/font/google";
import { BootGate } from "@/components/BootGate";
import { I18nProvider, LangToggle } from "@/lib/i18n";
import { LabTheme } from "@/components/LabTheme";
import { SentinelSeal } from "@/components/SentinelSeal";
import "./globals.css";

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const mono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Red Anchor Sentinel · AI智能体安全探测与防护工具",
  description: "AI agent security detection and protection. AI智能体安全探测与防护工具 for the host. AI agents stay under the owner's AI security.",
  applicationName: "Red Anchor Sentinel",
  keywords: ["AI智能体", "AI安全", "AI agent security", "Red Anchor Sentinel"],
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} pb-28 font-sans text-slate-200 antialiased`}>
        <div className="scanlines" aria-hidden />
        <I18nProvider>
          <div className="fixed right-3 top-3 z-50">
            <LangToggle />
          </div>
          <div className="relative z-10 px-4 pt-3 pr-24">
            <img src="/brand/lockup.jpg" alt="RED ANCHOR" className="h-24 w-auto" />
          </div>
          <LabTheme>
            <SentinelSeal />
            <BootGate>{children}</BootGate>
          </LabTheme>
        </I18nProvider>
      </body>
    </html>
  );
}
