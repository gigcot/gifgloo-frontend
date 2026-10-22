import type { Metadata } from "next";
import { Footer } from "@/shared/ui/Footer";
import { AnalyticsIdentity } from "@/shared/ui/AnalyticsIdentity";
import "./globals.css";

export const metadata: Metadata = {
  title: "gifgloo",
  description: "내 사진을 GIF 속으로",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AnalyticsIdentity />
        {children}
        <Footer />
      </body>
    </html>
  );
}
