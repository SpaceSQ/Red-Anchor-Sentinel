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
  title: "红锚哨兵",
  description: "L0 级智能体安全检测与可逆对齐补丁分发",
  applicationName: "红锚哨兵",
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${mono.variable} pb-12 font-sans text-slate-200 antialiased`}>
        <div className="scanlines" aria-hidden />
        <I18nProvider>
          <div className="fixed right-3 top-3 z-50">
            <LangToggle />
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
