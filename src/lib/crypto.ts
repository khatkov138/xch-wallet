// Простейшее и быстрое шифрование на Web Crypto API (нативное для браузеров)
export async function encryptMnemonic(mnemonic: string, pin: string): Promise<string> {
  try {
    const textEncoder = new TextEncoder()
    const passwordBuffer = textEncoder.encode(pin)
    
    // Хешируем пин-код для получения ключа фиксированной длины
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer)
    
    const key = await crypto.subtle.importKey(
      "raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt"]
    )
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, textEncoder.encode(mnemonic)
    )

    // Упаковываем IV и зашифрованные данные в одну строку для localStorage
    const resultBuffer = new Uint8Array(iv.length + encrypted.byteLength)
    resultBuffer.set(iv, 0)
    resultBuffer.set(new Uint8Array(encrypted), iv.length)
    
    return btoa(String.fromCharCode(...resultBuffer))
  } catch (e) {
    console.error("Encryption failed", e)
    throw new Error("Ошибка шифрования данных")
  }
}

export async function decryptMnemonic(encryptedData: string, pin: string): Promise<string> {
  try {
    const textDecoder = new TextDecoder()
    const binaryString = atob(encryptedData)
    const buffer = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i)
    }

    const iv = buffer.slice(0, 12)
    const data = buffer.slice(12)

    const passwordBuffer = new TextEncoder().encode(pin)
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer)
    
    const key = await crypto.subtle.importKey(
      "raw", hashBuffer, { name: "AES-GCM" }, false, ["decrypt"]
    )

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
    return textDecoder.decode(decrypted)
  } catch (e) {
    throw new Error("Неверный ПИН-код")
  }
}
