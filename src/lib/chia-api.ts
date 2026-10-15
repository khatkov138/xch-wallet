export async function fetchChiaBalance(address: string): Promise<number> {
  if (!address || address === "Загрузка..." || address.trim() === "") return 0

  try {
    // Стучимся на твой собственный рабочий API Route бэкенда Next.js
    const response = await fetch(`/api/chia/balance?address=${address}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    })

    if (!response.ok) throw new Error(`Status ${response.status}`)

    const json = await response.json()
    console.log("Ответ от нашего API Route:", json)
    
    // ИСПРАВЛЕНО: Парсим ровно то, что возвращает твой бэкенд от XCHscan.
    // Берем готовое число из json.xch. Если его нет, берем 0.
    const xchAmount = json?.xch !== undefined ? json.xch : 0
    
    return Number(xchAmount)
  } catch (error) {
    console.error("Ошибка fetchChiaBalance через API Route:", error)
    return 0
  }
}
