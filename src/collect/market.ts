// 테마 시황 경로의 수집기 (bin/brief.ts → ai/evaluate.ts). design/의 새 카드가 쓸 데이터.
import { getAccessToken, fetchToss, fetchDailyChange } from '../toss.ts'
import { collectThemeCaps, THEMES } from './themes.ts'
import { collectNews, queryForTheme } from './news.ts'
import type { MarketBrief, InvestorFlow, ThemeBrief } from '../types/market.ts'

const SPARK_DAYS = 30 // 카드 2 스파크라인 구간

async function fetchKospi(token: string): Promise<MarketBrief['kospi']> {
  const { price, pct, diff, closes } = await fetchDailyChange(
    `/api/v1/market-indicators/KOSPI/candles?interval=1d&count=${SPARK_DAYS}`,
    token,
  )
  return {
    value: price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct,
    isUp: pct >= 0,
    diff,
    series: closes,
  }
}

function flow(x: { buyAmount: string; sellAmount: string }): InvestorFlow {
  const buy = Number(x.buyAmount)
  const sell = Number(x.sellAmount)
  return { buy, sell, net: buy - sell }
}

async function fetchInvestorTrading(token: string): Promise<MarketBrief['investorTrading']> {
  const { result } = await fetchToss('/api/v1/market-indicators/KOSPI/investor-trading?interval=1d&count=1', token)
  const r = result.records[0]
  return { individual: flow(r.individual), foreigner: flow(r.foreigner), institution: flow(r.institution) }
}

/** 오늘의 테마 = 등락률 절댓값이 가장 큰 섹터. 가장 많이 오른 쪽일 수도, 빠진 쪽일 수도 있다. */
export function pickTodayTheme(themes: ThemeBrief[]): string {
  return themes.reduce((best, t) => (Math.abs(t.returnPct) > Math.abs(best.returnPct) ? t : best)).theme
}

/** 카드뉴스 템플릿용 시장 종합 데이터를 하나의 JSON으로 수집. */
export async function collectMarketBrief(): Promise<MarketBrief> {
  const token = await getAccessToken()
  const [kospi, investorTrading, themeCaps, news] = await Promise.all([
    fetchKospi(token),
    fetchInvestorTrading(token),
    collectThemeCaps(THEMES, { market: 'KOSPI' }), // 코스피 구성종목 전체 (시총 내림차순)
    collectNews({ limit: 10 }), // 시장 전체 뉴스 후보 (marketEval 근거용)
  ])

  const themes: ThemeBrief[] = themeCaps
    .map(({ theme, stocks }): ThemeBrief => {
      const totalCap = stocks.reduce((s, x) => s + x.cap, 0)
      const returnPct = totalCap
        ? Number((stocks.reduce((s, x) => s + x.pct * x.cap, 0) / totalCap).toFixed(2))
        : 0
      return { theme, returnPct, top3: stocks.slice(0, 3) }
    })
    .sort((a, b) => b.returnPct - a.returnPct) // 카드 3 랭킹 순서

  // 오늘의 테마는 시총 집계가 끝나야 정해지므로 테마 뉴스는 여기서 2차 수집.
  // 위 시장 뉴스는 라운드로빈이라 테마당 1~2건뿐이라 그중에서 3건을 고를 수 없다.
  const todayTheme = pickTodayTheme(themes)
  const themeNews = await collectNews({ limit: 8, queries: [queryForTheme(todayTheme)] })

  return {
    date: new Date().toISOString().slice(0, 10),
    kospi,
    investorTrading,
    themes,
    todayTheme,
    news,
    themeNews,
  }
}
