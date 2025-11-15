import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WTA Dashboard - Real-time Monitor",
  description: "Real-time monitoring dashboard for Arma 3 WTA plugin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}
