import { getAccessToken, fetchToss, fetchDailyChange } from '../toss.ts'
import type { ThemeCap, ThemeResult } from '../types/market.ts'

// 토스 API엔 테마 분류가 없어 구성종목은 수기 큐레이션(코스피/코스닥 섞임 — market으로 필터).
// ponytail: 종목 편입은 손으로 유지. 자동 분류가 필요해지면 외부 소스를 붙일 것.
// 각 테마 = 해당 섹터 시총 상위 5 (2026-07 기준. 섹터 후보는 TradingView 집계로 확인).
// 나열 순서가 시총 내림차순이고, 주석의 종목명·시총은 토스 기준 —
// `node bin/themes.ts --top 5`로 그대로 검증된다.
//
// 두 가지는 시총 순위를 그대로 따르지 않고 손으로 걸렀다:
//  1. 지주사 — 자회사가 이미 편입돼 있으면 제외. 시총가중 평균에서 같은 회사에 두 번
//     가중치가 실린다. 반도체의 SK스퀘어(146조, 하이닉스 지분)와 뷰티의 아모레퍼시픽홀딩스가 해당.
//  2. 업종 분류가 테마 의도와 어긋나는 경우 — 전력 업종 시총 1·3위 LG에너지솔루션·삼성SDI는
//     배터리, 2·3위권 삼성물산·HD현대중공업은 건설·조선이라 전력기기 테마에서 제외.
//
// 시총 순위는 계속 바뀌므로 이 목록은 주기적으로 다시 확인해야 한다.
// ponytail: 편입은 판단이 필요해 수기 유지. 자동 재편이 필요해지면 섹터 분류 소스를 붙일 것.
export const THEMES: Record<string, string[]> = {
  // 삼성전자 1476조 / SK하이닉스 1269조 / 삼성전기 101조 / 한미반도체 19조 / LG이노텍 15조
  반도체: ['005930', '000660', '009150', '042700', '011070'],
  // NAVER 33조 / 삼성에스디에스 16.3조 / 카카오 16.0조 / 크래프톤 11조 / 현대오토에버 11조
  소프트웨어: ['035420', '018260', '035720', '259960', '307950'],
  // 두산에너빌리티 46조 / LS ELECTRIC 30조 / HD현대일렉트릭 29조 / 효성중공업 25조 / 한국전력 23조
  전력: ['034020', '010120', '267260', '298040', '015760'],
  // 에이피알 13조 / 아모레퍼시픽 7.0조 / LG생활건강 3.7조 / 달바글로벌 3.0조 / 한국콜마 2.4조
  뷰티: ['278470', '090430', '051900', '483650', '161890'],
  // 삼성생명 64조 / KB금융 61조 / 신한지주 50조 / 하나금융지주 37조 / 삼성화재 29조
  금융: ['032830', '105560', '055550', '086790', '000810'],
  // 현대차 82조 / 기아 52조 / 현대모비스 44조 / 한국타이어앤테크놀로지 8.8조 / 한온시스템 3.6조
  자동차: ['005380', '000270', '012330', '161390', '018880'],
  // HD현대중공업 51조 / 한화오션 27조 / HD한국조선해양 26조 / 삼성중공업 20조 / HJ중공업 1.5조
  조선: ['329180', '042660', '009540', '010140', '097230'],
  // 삼성바이오로직스 70조 / 셀트리온 39조 / SK바이오팜 6.3조 / 유한양행 5.6조 / 한미약품 5.0조
  // 알테오젠(16조)은 시총 3위급이지만 코스닥이라 제외 — market 필터에 걸러진다.
  바이오: ['207940', '068270', '326030', '000100', '128940'],
  // 한화에어로스페이스 50조 / 현대로템 17조 / LIG디펜스앤에어로스페이스 17조 / 한국항공우주 15조 / 한화시스템 13조
  방산: ['012450', '064350', '079550', '047810', '272210'],
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
      quote[code] = await fetchDailyChange(`/api/v1/candles?symbol=${code}&interval=1d&count=2`, token)
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
