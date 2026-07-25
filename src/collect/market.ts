// 테마 시황 경로의 수집기 (bin/brief.ts → ai/evaluate.ts). design/의 새 카드가 쓸 데이터.
import { getAccessToken, fetchToss, fetchDailyChange } from '../toss.ts'
import { collectThemeCaps, THEMES } from './themes.ts'
import { collectNews } from './news.ts'
import type { MarketBrief, InvestorFlow, ThemeBrief } from '../types/market.ts'

async function fetchKospi(token: string): Promise<MarketBrief['kospi']> {
  const { price, pct } = await fetchDailyChange('/api/v1/market-indicators/KOSPI/candles?interval=1d&count=2', token)
  return {
    value: price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct,
    isUp: pct >= 0,
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

/** 카드뉴스 템플릿용 시장 종합 데이터를 하나의 JSON으로 수집. */
export async function collectMarketBrief(): Promise<MarketBrief> {
  const token = await getAccessToken()
  const [kospi, investorTrading, themeCaps, news] = await Promise.all([
    fetchKospi(token),
    fetchInvestorTrading(token),
    collectThemeCaps(THEMES, { market: 'KOSPI' }), // 코스피 구성종목 전체 (시총 내림차순)
    collectNews({ limit: 10 }), // 시장+테마 뉴스 후보 (쿼리는 news.ts의 NEWS_QUERIES, AI가 선별)
  ])

  const themes: ThemeBrief[] = themeCaps.map(({ theme, stocks }): ThemeBrief => {
    const totalCap = stocks.reduce((s, x) => s + x.cap, 0)
    const returnPct = totalCap
      ? Number((stocks.reduce((s, x) => s + x.pct * x.cap, 0) / totalCap).toFixed(2))
      : 0
    return { theme, returnPct, top3: stocks.slice(0, 3) }
  })

  return { date: new Date().toISOString().slice(0, 10), kospi, investorTrading, themes, news }
}
