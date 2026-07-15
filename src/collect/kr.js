const BASE = 'https://openapi.tossinvest.com'

async function getAccessToken() {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TOSS_CLIENT_ID,
      client_secret: process.env.TOSS_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`토스증권 토큰 발급 실패: ${res.status}`)
  const json = await res.json()
  return json.access_token
}

async function fetchJson(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`토스증권 조회 실패 (${path}): ${res.status}`)
  return res.json()
}

function quoteFromCandles(candles) {
  const latest = parseFloat(candles[0].closePrice)
  const prev = parseFloat(candles[1].closePrice)
  const pct = ((latest - prev) / prev) * 100
  return { latest, pct: Number(Math.abs(pct).toFixed(2)), isUp: pct >= 0 }
}

async function fetchIndex(symbol, name, token) {
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

async function fetchStock(code, name, token) {
  const { result } = await fetchJson(`/api/v1/candles?symbol=${code}&interval=1d&count=2`, token)
  const q = quoteFromCandles(result.candles)
  return { code, name, value: q.latest.toLocaleString('en-US'), pct: q.pct, isUp: q.isUp }
}

export function demoKr(watchlist) {
  return {
    kospi: { code: 'KOSPI', name: '코스피', value: '7,246.79', pct: 5.35, isUp: false },
    kosdaq: { code: 'KOSDAQ', name: '코스닥', value: '785.00', pct: 5.56, isUp: false },
    watchlist: watchlist.map((w, i) => ({ code: w.code, name: w.name, value: '277,500', pct: 6.25, isUp: i % 2 === 0 })),
  }
}

export async function collectKr(watchlist, { demo = false } = {}) {
  if (demo) return demoKr(watchlist)
  const token = await getAccessToken()
  const [kospi, kosdaq, ...stocks] = await Promise.all([
    fetchIndex('KOSPI', '코스피', token),
    fetchIndex('KOSDAQ', '코스닥', token),
    ...watchlist.map((w) => fetchStock(w.code, w.name, token)),
  ])
  return { kospi, kosdaq, watchlist: stocks }
}
