import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "AI 无限百科 - 无限探索",
  description: "登录后生成可点击、可继续深入探索的视觉知识地图",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-hidden">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
