// Внутри src/env.ts
/*import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_CONTRACT_HEX: z.string().min(1),
  NEXT_PUBLIC_CHIA_PORT: z.string().transform((v) => parseInt(v, 10)),
  NEXT_PUBLIC_CHIA_COIN: z.string().transform((v) => parseInt(v, 10)),
  NEXT_PUBLIC_CHIA_CHARSET: z.string().min(1),
  NEXT_PUBLIC_CHIA_GROUP_ORDER: z.string().min(1),
  NEXT_PUBLIC_CHIA_HIDDEN_PUZZLE_HASH: z.string().min(1),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_CONTRACT_HEX: process.env.NEXT_PUBLIC_CONTRACT_HEX,
  NEXT_PUBLIC_CHIA_PORT: process.env.NEXT_PUBLIC_CHIA_PORT,
  NEXT_PUBLIC_CHIA_COIN: process.env.NEXT_PUBLIC_CHIA_COIN,
  NEXT_PUBLIC_CHIA_CHARSET: process.env.NEXT_PUBLIC_CHIA_CHARSET,
  NEXT_PUBLIC_CHIA_GROUP_ORDER: process.env.NEXT_PUBLIC_CHIA_GROUP_ORDER,
  NEXT_PUBLIC_CHIA_HIDDEN_PUZZLE_HASH: process.env.NEXT_PUBLIC_CHIA_HIDDEN_PUZZLE_HASH,
});

if (!parsed.success) {
  console.error("❌ Невалидные переменные окружения:", parsed.error.format());
  throw new Error("Критическая ошибка конфигурации приложения");
}

// 🔥 Строго экспортируем готовый объект
export const env = parsed.data;
*/