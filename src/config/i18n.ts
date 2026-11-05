// 🌐 Единый источник правды для языков кошелька XCHIA
export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;

// TypeScript тип на основе массива ('en' | 'ru')
export type WalletLanguage = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: WalletLanguage = 'en';

/**
 * Валидирует, поддерживается ли переданная строка как язык в приложении
 */
export function isSupportedLanguage(lang: string): lang is WalletLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as WalletLanguage);
}
