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
  title: "XCHIA — Безопасный веб-кошелек нового поколения для Chia (XCH)",
  description: "Премиальный некастодиальный real-time кошелек для Chia Network в вашем браузере. 100% Open Source, локальное шифрование ключей без скачивания тяжелых программ.",
  metadataBase: new URL("https://xchia.io"),
  keywords: ["Chia Network", "XCH", "Chia кошелек", "XCHIA", "web wallet", "non-custodial", "crypto wallet", "Chia RPC"],
  authors: [{ name: "XCHIA Team" }],
  
  // Open Graph для Telegram, ВК, Discord и Facebook
  openGraph: {
    title: "XCHIA — Безопасный веб-кошелек для Chia (XCH)",
    description: "Работает прямо в браузере. Локальное шифрование, открытый исходный код, моментальная синхронизация.",
    url: "https://xchia.io",
    siteName: "XCHIA Wallet",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/og-image.png", // Не забудьте положить красивый скриншот в public/
        width: 1200,
        height: 630,
        alt: "Интерфейс веб-кошелька XCHIA",
      },
    ],
  },

  // Twitter Cards
  twitter: {
    card: "summary_large_image",
    title: "XCHIA — Next-Gen Chia Network Web Wallet",
    description: "Premium Non-Custodial Real-Time Wallet for Chia (XCH). 100% Open Source.",
    images: ["/og-image.png"],
  },

  // Управление роботами
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Иконки и мобильный Web App
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
