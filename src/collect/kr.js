const BASE = 'https://polling.finance.naver.com/api/realtime/domestic'

async function fetchNaver(type, codes) {
  const res = await fetch(`${BASE}/${type}/${codes.join(',')}`)
  if (!res.ok) throw new Error(`naver ${type} 조회 실패: ${res.status}`)
  const json = await res.json()
  return json.datas
}

function toQuote(d) {
  const pct = parseFloat(d.fluctuationsRatio)
  return { code: d.itemCode, name: d.stockName, value: d.closePrice, pct: Math.abs(pct), isUp: pct >= 0 }
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
  const [indexData, stockData] = await Promise.all([
    fetchNaver('index', ['KOSPI', 'KOSDAQ']),
    fetchNaver('stock', watchlist.map((w) => w.code)),
  ])
  const kospi = toQuote(indexData.find((d) => d.itemCode === 'KOSPI'))
  const kosdaq = toQuote(indexData.find((d) => d.itemCode === 'KOSDAQ'))
  return { kospi, kosdaq, watchlist: stockData.map(toQuote) }
}
