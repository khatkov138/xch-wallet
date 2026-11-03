import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function handleApi<T>(promise: Promise<Response>): Promise<T> {
  const res = await promise;
  let json: any;

  try {
    json = await res.json();
  } catch (parseError) {
    // ФИКС: Если сервер вместо JSON выплюнул HTML-ошибку (<!DOCTYPE...), 
    // мы перехватываем этот момент и пишем красивую фразу для клиента
    throw new Error("Не удалось связаться с сервером. Попробуйте позже");
  }

  // Если запрос вернулся с плохим HTTP статусом или флагом неуспеха
  if (!res.ok || !json || !json.success) {
    throw new Error(json?.error || `Ошибка сервера: ${res.status}`);
  }

  // Возвращаем чистые данные
  return json.data as T;
}

/**
 * Преобразует Mojo (string | number | bigint) в строковое представление XCH (до 12 знаков).
 * Без JS плавающей точки, без лишних нулей на конце. Гарантирует Layout Stability.
 */
export function formatMojoToXchString(mojoInput: string | number | bigint | undefined | null): string {
  if (mojoInput === undefined || mojoInput === null) return "0 XCH"
  
  const mojoObj = BigInt(mojoInput)
  if (mojoObj === 0n) return "0 XCH"

  const sign = mojoObj < 0n ? "-" : ""
  const absoluteMojo = mojoObj < 0n ? -mojoObj : mojoObj

  const mojoStr = absoluteMojo.toString().padStart(13, '0')
  const integerPart = mojoStr.slice(0, -12)
  const fractionalPart = mojoStr.slice(-12).replace(/0+$/, "")

  const result = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart
  return `${sign}${result} XCH`
}

