import yahooFinance from 'yahoo-finance2'

const TICKERS = { sp500: '^GSPC', nasdaq: '^IXIC', dow: '^DJI' }

function toQuote(q) {
  const pct = q.regularMarketChangePercent
  return {
    value: q.regularMarketPrice.toLocaleString('en-US'),
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
  const symbols = Object.values(TICKERS)
  const quotes = await yahooFinance.quote(symbols)
  const bySymbol = Object.fromEntries(quotes.map((q) => [q.symbol, q]))
  return {
    sp500: toQuote(bySymbol['^GSPC']),
    nasdaq: toQuote(bySymbol['^IXIC']),
    dow: toQuote(bySymbol['^DJI']),
  }
}
