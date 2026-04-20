import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Mono, Inter, Roboto, Source_Sans_3, Lato } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Brand-approximation fonts applied per service (see src/lib/services.ts)
const brandInter = Inter({
  subsets: ["latin"],
  variable: "--font-brand-inter",
  display: "swap",
});
const brandRoboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-brand-roboto",
  display: "swap",
});
const brandSourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-brand-source-sans",
  display: "swap",
});
const brandLato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-brand-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Outage Map · Enterprise Status",
  description:
    "Real-time outage monitoring with analytics, geographic insights, and alerts for Microsoft 365, Adobe, ServiceNow, Salesforce, Workday, Zoom, and Google Workspace.",
  keywords: [
    "outage",
    "dashboard",
    "status",
    "uptime",
    "monitoring",
    "enterprise",
    "Microsoft 365",
    "Salesforce",
    "Zoom",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${notoSans.variable} ${notoSansMono.variable} ${brandInter.variable} ${brandRoboto.variable} ${brandSourceSans.variable} ${brandLato.variable} antialiased`}
      >
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
