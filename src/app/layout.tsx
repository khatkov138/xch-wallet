import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from 'next/headers' // 🍪 Импортируем утилиту чтения кук Next.js 16
import { Providers } from "@/providers/Providers"; // Наш импорт провайдера кэша

import { DEFAULT_LANGUAGE, isSupportedLanguage } from '@/config/i18n'
import { UserSettingsProps } from '@/store/useUserSettingsStore'
import "./globals.css";
import { UserSettingsContextProvider } from "@/providers/UserSettnigsProvider";

// ⚡ Разрешаем асинхронное динамическое чтение кук при переходах на верхнем уровне
export const instant = false

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
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
        url: "/og-image.png",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🍪 Читаем куки на сервере для первичного сидирования фабрики Zustand
  const cookieStore = await cookies()
  const cookieLang = cookieStore.get('xchia-lang')?.value
  const cookieNet = cookieStore.get('xchia-network')?.value

  const lang = cookieLang && isSupportedLanguage(cookieLang) ? cookieLang : DEFAULT_LANGUAGE
  const network = cookieNet === 'mainnet' ? 'mainnet' : 'testnet11'

  // 🔥 Твое дожатое решение типизации: сужаем string до литералов через as UserSettingsProps
  const serverSettings = {
    network,
    language: lang,
    currency: lang === 'ru' ? 'RUB' : 'USD',
    balanceDisplay: 'xch'
  } as UserSettingsProps

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white font-sans select-none">
        
        {/* 📦 1. УРОВЕНЬ 1: Накачиваем серверные куки в Zustand до маунта сокетов */}
        <UserSettingsContextProvider serverSettings={serverSettings}>
          
          {/* 🚀 УРОВЕНЬ 2: Твой провайдер кэша TanStack Query и WebSocket-демона */}
          <Providers>
            {children}
          </Providers>

        </UserSettingsContextProvider>
        
      </body>
    </html>
  );
}
