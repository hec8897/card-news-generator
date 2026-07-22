import { getAccessToken, fetchToss } from './toss.ts'
import type { ThemeCap, ThemeResult } from '../types.ts'

// 토스 API엔 테마 분류가 없어 구성종목은 수기 큐레이션(코스피/코스닥 섞임 — market으로 필터).
// ponytail: 종목 편입은 손으로 유지. 자동 분류가 필요해지면 외부 소스를 붙일 것.
export const THEMES: Record<string, string[]> = {
  반도체: ['005930', '000660', '009150', '402340', '042700', '000990'],
  소프트웨어: ['035420', '035720', '018260', '259960', '036570', '251270'],
  전력: ['015760', '034020', '267260', '010120', '298040', '052690'],
}

/** 테마별 구성종목 시가총액을 실시간 계산해 시총 내림차순으로 반환. */
export async function collectThemeCaps(
  themes: Record<string, string[]> = THEMES,
  { topN, market }: { topN?: number; market?: string } = {},
): Promise<ThemeResult[]> {
  const token = await getAccessToken()
  const allSymbols = [...new Set(Object.values(themes).flat())]

  const [{ result: stocks }, { result: prices }] = await Promise.all([
    fetchToss(`/api/v1/stocks?symbols=${allSymbols.join(',')}`, token),
    fetchToss(`/api/v1/prices?symbols=${allSymbols.join(',')}`, token),
  ])
  const info: Record<string, any> = Object.fromEntries(stocks.map((s: any) => [s.symbol, s]))
  const priceBy: Record<string, number> = Object.fromEntries(
    prices.map((p: any) => [p.symbol, parseFloat(p.lastPrice)]),
  )

  return Object.entries(themes).map(([theme, symbols]): ThemeResult => {
    let caps = symbols
      .map((code): ThemeCap | null => {
        const s = info[code]
        const price = priceBy[code]
        if (!s || !price) return null
        return { code, name: s.name, market: s.market, price, cap: Number(s.sharesOutstanding) * price }
      })
      .filter((c): c is ThemeCap => c !== null)
      .filter((c) => !market || c.market === market)
      .sort((a, b) => b.cap - a.cap)
    if (topN) caps = caps.slice(0, topN)
    return { theme, stocks: caps }
  })
}
