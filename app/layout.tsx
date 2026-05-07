import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://xianshi.icu"),
  title: {
    default: "AI 无限百科",
    template: "%s | AI 无限百科",
  },
  description: "登录后生成可点击、可继续深入探索的视觉知识地图",
  openGraph: {
    title: "AI 无限百科",
    description: "输入想法或图片，生成可点击、可讲解、可继续深入探索的视觉知识地图。",
    url: "https://xianshi.icu/",
    siteName: "AI 无限百科",
    images: [
      {
        url: "/generated-images/curated/homepage-hero-snow-leopard.png",
        width: 1536,
        height: 864,
        alt: "AI 无限百科视觉知识地图示例",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
