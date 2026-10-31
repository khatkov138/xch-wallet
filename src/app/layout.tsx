import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/providers/Providers"; // Наш импорт провайдера кэша
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XCHA Wallet — Next-Gen Chia Wallet",
  description: "Premium Non-Custodial Fintech Wallet for Chia (XCH)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white font-sans select-none">
        {/* Обертываем все дочерние страницы в контекст TanStack Query */}

        <Providers>
        
          {children}
        </Providers>
      </body>
    </html>
  );
}
