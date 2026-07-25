// 구 발행 경로 전용 수집기 (pipeline.ts → render/neon.html).
// 코스피/코스닥 지수 + 거래대금 상위 3종목. design/의 새 테마 카드로 넘어가면 market.ts가 대체한다.
import { getAccessToken, fetchToss, fetchDailyChange } from '../toss.ts'
import { collectNews } from './news.ts'
import type { CollectOpts, Quote } from '../types/shared.ts'
import type { DailyData, KrData } from '../types/card.ts'

const TOP_STOCK_COUNT = 3

async function fetchIndex(symbol: string, name: string, token: string): Promise<Quote> {
  const { price, pct } = await fetchDailyChange(
    `/api/v1/market-indicators/${symbol}/candles?interval=1d&count=2`,
    token,
  )
  return {
    code: symbol,
    name,
    value: price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: Math.abs(pct),
    isUp: pct >= 0,
  }
}

async function fetchTopStocks(token: string): Promise<Quote[]> {
  const { result } = await fetchToss(
    `/api/v1/rankings?type=MARKET_TRADING_AMOUNT&marketCountry=KR&duration=realtime&count=${TOP_STOCK_COUNT}`,
    token,
  )
  const symbols = result.rankings.map((r: any) => r.symbol)
  const { result: stocks } = await fetchToss(`/api/v1/stocks?symbols=${symbols.join(',')}`, token)
  const nameBySymbol: Record<string, string> = Object.fromEntries(stocks.map((s: any) => [s.symbol, s.name]))

  return result.rankings.map((r: any): Quote => {
    const pct = parseFloat(r.price.changeRate) * 100
    return {
      code: r.symbol,
      name: nameBySymbol[r.symbol] ?? r.symbol,
      value: parseFloat(r.price.lastPrice).toLocaleString('en-US'),
      pct: Number(Math.abs(pct).toFixed(2)),
      isUp: pct >= 0,
    }
  })
}

export function demoKr(): KrData {
  return {
    kospi: { code: 'KOSPI', name: '코스피', value: '7,246.79', pct: 5.35, isUp: false },
    kosdaq: { code: 'KOSDAQ', name: '코스닥', value: '785.00', pct: 5.56, isUp: false },
    watchlist: [
      { code: '005930', name: '삼성전자', value: '277,500', pct: 6.25, isUp: true },
      { code: '000660', name: 'SK하이닉스', value: '2,022,000', pct: 5.3, isUp: true },
      { code: '035420', name: 'NAVER', value: '184,400', pct: 4.31, isUp: false },
    ],
  }
}

export async function collectKr({ demo = false }: CollectOpts = {}): Promise<KrData> {
  if (demo) return demoKr()
  const token = await getAccessToken()
  const [kospi, kosdaq, watchlist] = await Promise.all([
    fetchIndex('KOSPI', '코스피', token),
    fetchIndex('KOSDAQ', '코스닥', token),
    fetchTopStocks(token),
  ])
  return { kospi, kosdaq, watchlist }
}

function pick<T>(result: PromiseSettledResult<T>, warnings: string[], message: string): T | null {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${message}: ${(result.reason as Error).message}`)
  return null
}

/** 시황+뉴스를 병렬 수집. 뉴스는 없어도 진행하지만 시황이 없으면 발행 자체가 불가. */
export async function collectDaily(opts: CollectOpts = {}): Promise<DailyData> {
  const warnings: string[] = []
  const [krResult, newsResult] = await Promise.allSettled([collectKr(opts), collectNews(opts)])

  const kr = pick(krResult, warnings, '한국 시황 수집 실패')
  const headlines = pick(newsResult, warnings, '뉴스 헤드라인 수집 실패') ?? []

  if (!kr) throw new Error(`collect: 국내 시황 데이터 수집 실패 — ${warnings.join(' / ')}`)

  return { date: new Date(), kr, headlines, warnings }
}
