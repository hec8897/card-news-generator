import { getAccessToken, fetchToss } from './toss.ts'
import type { ThemeCap, ThemeResult } from '../types.ts'

// 토스 API엔 테마 분류가 없어 구성종목은 수기 큐레이션(코스피/코스닥 섞임 — market으로 필터).
// ponytail: 종목 편입은 손으로 유지. 자동 분류가 필요해지면 외부 소스를 붙일 것.
export const THEMES: Record<string, string[]> = {
  반도체: ['005930', '000660', '009150', '402340', '042700', '000990'],
  소프트웨어: ['035420', '035720', '018260', '259960', '036570', '251270'],
  전력: ['015760', '034020', '267260', '010120', '298040', '052690'],
}

// 일봉 2개(오늘/전일)로 장마감 종가·등락률 계산. /prices는 시간외까지 섞여 "장마감 기준"이 안 됨.
async function fetchCloseQuote(code: string, token: string): Promise<{ price: number; pct: number }> {
  const { result } = await fetchToss(`/api/v1/candles?symbol=${code}&interval=1d&count=2`, token)
  const c = result.candles
  const price = parseFloat(c[0].closePrice)
  const prev = parseFloat(c[1].closePrice)
  return { price, pct: Number((((price - prev) / prev) * 100).toFixed(2)) }
}

/** 테마별 구성종목의 장마감 종가·등락률·시가총액을 시총 내림차순으로 반환. */
export async function collectThemeCaps(
  themes: Record<string, string[]> = THEMES,
  { topN, market }: { topN?: number; market?: string } = {},
): Promise<ThemeResult[]> {
  const token = await getAccessToken()
  const allSymbols = [...new Set(Object.values(themes).flat())]

  const { result: stocks } = await fetchToss(`/api/v1/stocks?symbols=${allSymbols.join(',')}`, token)
  const info: Record<string, any> = Object.fromEntries(stocks.map((s: any) => [s.symbol, s]))

  // 종목별 장마감 종가/등락률. ponytail: 순차 호출 — 병렬로 쏘면 토스 rate-limit(429).
  // 종목 수가 많이 늘면 소규모 동시성 풀로. 조회 실패 종목(상폐/일시오류)은 조용히 제외.
  const quote: Record<string, { price: number; pct: number }> = {}
  for (const code of allSymbols) {
    try {
      quote[code] = await fetchCloseQuote(code, token)
    } catch {
      /* 상폐/미존재 종목만 제외 (429는 fetchToss가 재시도) */
    }
    await new Promise((r) => setTimeout(r, 120)) // rate-limit 완화
  }

  return Object.entries(themes).map(([theme, symbols]): ThemeResult => {
    let caps = symbols
      .map((code): ThemeCap | null => {
        const s = info[code]
        const q = quote[code]
        if (!s || !q) return null
        return { code, name: s.name, market: s.market, price: q.price, pct: q.pct, cap: Number(s.sharesOutstanding) * q.price }
      })
      .filter((c): c is ThemeCap => c !== null)
      .filter((c) => !market || c.market === market)
      .sort((a, b) => b.cap - a.cap)
    if (topN) caps = caps.slice(0, topN)
    return { theme, stocks: caps }
  })
}
