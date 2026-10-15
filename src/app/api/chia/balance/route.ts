import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  try {
    // Сервер делает запрос по ПРАВИЛЬНОМУ API-адресу Spacescan
    const response = await fetch(`https://xchscan.com/api/account/balance?address=${address}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      next: { revalidate: 30 } // Кэш на 30 секунд
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Spacescan error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
