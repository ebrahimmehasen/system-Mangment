import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const sansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "404 LAGEND — نظام الإدارة الداخلي",
  description: "نظام إدارة داخلي لإدارة العملاء والمشاريع والمدفوعات والمصروفات.",
  applicationName: "404 LAGEND",
  appleWebApp: { capable: true, title: "404 LAGEND", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${sansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
