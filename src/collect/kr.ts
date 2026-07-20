import type { KrData, Quote, CollectOpts } from '../types.ts'

const BASE = 'https://openapi.tossinvest.com'
const TOP_STOCK_COUNT = 3

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TOSS_CLIENT_ID ?? '',
      client_secret: process.env.TOSS_CLIENT_SECRET ?? '',
    }),
  })
  if (!res.ok) throw new Error(`토스증권 토큰 발급 실패: ${res.status}`)
  const json = await res.json()
  return json.access_token
}

async function fetchJson(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`토스증권 조회 실패 (${path}): ${res.status}`)
  return res.json()
}

function quoteFromCandles(candles: { closePrice: string }[]) {
  const latest = parseFloat(candles[0].closePrice)
  const prev = parseFloat(candles[1].closePrice)
  const pct = ((latest - prev) / prev) * 100
  return { latest, pct: Number(Math.abs(pct).toFixed(2)), isUp: pct >= 0 }
}

async function fetchIndex(symbol: string, name: string, token: string): Promise<Quote> {
  const { result } = await fetchJson(`/api/v1/market-indicators/${symbol}/candles?interval=1d&count=2`, token)
  const q = quoteFromCandles(result.candles)
  return {
    code: symbol,
    name,
    value: q.latest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: q.pct,
    isUp: q.isUp,
  }
}

async function fetchTopStocks(token: string): Promise<Quote[]> {
  const { result } = await fetchJson(
    `/api/v1/rankings?type=MARKET_TRADING_AMOUNT&marketCountry=KR&duration=realtime&count=${TOP_STOCK_COUNT}`,
    token,
  )
  const symbols = result.rankings.map((r: any) => r.symbol)
  const { result: stocks } = await fetchJson(`/api/v1/stocks?symbols=${symbols.join(',')}`, token)
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
