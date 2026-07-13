const SERIES = { sp500: 'SP500', nasdaq: 'NASDAQCOM', dow: 'DJIA' }

async function fetchFredSeries(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`)
  if (!res.ok) throw new Error(`FRED ${id} 조회 실패: ${res.status}`)
  const text = await res.text()
  const rows = text
    .trim()
    .split('\n')
    .slice(1) // 헤더(observation_date,<id>) 제외
    .map((line) => line.split(','))
    .filter(([, value]) => value) // 휴장일은 값이 비어있음 — 제외

  if (rows.length < 2) throw new Error(`FRED ${id}: 유효한 데이터 부족`)
  const [, latest] = rows[rows.length - 1]
  const [, prev] = rows[rows.length - 2]
  return { latest: parseFloat(latest), prev: parseFloat(prev) }
}

function toQuote({ latest, prev }) {
  const pct = ((latest - prev) / prev) * 100
  return {
    value: latest.toLocaleString('en-US'),
    pct: Math.abs(pct).toFixed(2),
    isUp: pct >= 0,
  }
}

export function demoUs() {
  return {
    sp500: { value: '5,432.10', pct: '0.45', isUp: true },
    nasdaq: { value: '17,890.55', pct: '0.34', isUp: true },
    dow: { value: '39,120.00', pct: '0.12', isUp: false },
  }
}

export async function collectUs({ demo = false } = {}) {
  if (demo) return demoUs()
  const [sp500, nasdaq, dow] = await Promise.all([
    fetchFredSeries(SERIES.sp500),
    fetchFredSeries(SERIES.nasdaq),
    fetchFredSeries(SERIES.dow),
  ])
  return {
    sp500: toQuote(sp500),
    nasdaq: toQuote(nasdaq),
    dow: toQuote(dow),
  }
}
