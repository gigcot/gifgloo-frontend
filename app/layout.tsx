import type { Metadata } from "next";
import Script from "next/script";
import { Footer } from "@/shared/ui/Footer";
import { UmamiIdentity } from "@/shared/ui/UmamiIdentity";
import { WebVitalsReporter } from "@/shared/ui/WebVitalsReporter";
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
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="8290b22d-046d-42de-802e-bad85d1cb8ca"
          strategy="afterInteractive"
        />
        <UmamiIdentity />
        <WebVitalsReporter />
        {children}
        <Footer />
      </body>
    </html>
  );
}
