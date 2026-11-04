import { NextResponse } from 'next/server';

const DEFAULT_PRICE_XCH_USD = 1;
const DEFAULT_PRICE_XCH_RUB = 100; 
const CACHE_TTL_MS = 60 * 1000;

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=chia&vs_currencies=usd,rub";

let priceCache = {
  usd: DEFAULT_PRICE_XCH_USD,
  rub: DEFAULT_PRICE_XCH_RUB,
  expiresAt: 0,
  hasRealData: false 
};

export async function GET() {
  const currentTime = Date.now();
  let currentStage = "INIT";

  if (currentTime < priceCache.expiresAt && priceCache.hasRealData) {
    return NextResponse.json({
      success: true,
      source: "next_memory_cache",
      usd: priceCache.usd,
      rub: priceCache.rub
    }, { status: 200 });
  }

  try {
    currentStage = "NETWORK_FETCH";
    const res = await fetch(COINGECKO_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 600 }
    });

    if (!res.ok) throw new Error(`HTTP_${res.status}`);

    currentStage = "JSON_PARSING";
    const data = await res.json();

    currentStage = "DATA_VALIDATION";
    if (data?.chia?.usd && data?.chia?.rub) {
      priceCache = {
        usd: Number(data.chia.usd),
        rub: Number(data.chia.rub),
        expiresAt: currentTime + CACHE_TTL_MS,
        hasRealData: true
      };

      return NextResponse.json({
        success: true,
        source: "next_network_fetch",
        usd: priceCache.usd,
        rub: priceCache.rub
      }, { status: 200 });
    }
    
    throw new Error("BAD_TOPOLOGY");

  } catch (error) {
    console.error(`🚨 [PRICES_PROXY_CRASH] Stage: ${currentStage} | Error: ${error instanceof Error ? error.message : "UNKNOWN"}`);

    if (priceCache.hasRealData) {
      return NextResponse.json({
        success: false, 
        source: "next_stale_fallback",
        usd: priceCache.usd,
        rub: priceCache.rub,
        error: error instanceof Error ? error.message : "UNKNOWN"
      }, { status: 203 });
    }

    return NextResponse.json({
      success: false,
      source: "next_emergency_failure",
      usd: DEFAULT_PRICE_XCH_USD,
      rub: DEFAULT_PRICE_XCH_RUB,
      detail: "Currency rates service unavailable.",
      error_context: { stage: currentStage, message: error instanceof Error ? error.message : "UNKNOWN" }
    }, { status: 503 });
  }
}
