// 테마 시황 경로(collect/market.ts → ai/evaluate.ts)의 어휘.
import type { Headline } from './shared.ts'

/** 테마 구성종목: 장마감 종가/등락률 + 시총 (시총은 상장주식수×종가, 우선주 포함 가능 — 순위 참고용) */
export interface ThemeCap {
  code: string
  name: string
  market: string // 'KOSPI' | 'KOSDAQ'
  price: number // 장마감 종가
  pct: number // 전일 대비 등락률 % (부호 있음)
  cap: number // 시가총액
}

export interface ThemeResult {
  theme: string
  stocks: ThemeCap[] // 시총 내림차순
}

export interface ThemeBrief {
  theme: string
  returnPct: number // 시총 가중 평균 등락률 %
  top3: ThemeCap[] // 시총 상위 3 (각 종목 일일 등락률 포함)
}

/** 투자자별 거래대금 (원). net = 순매수(매수-매도) */
export interface InvestorFlow {
  buy: number
  sell: number
  net: number
}

/** 카드뉴스용 시장 종합 데이터 (시장 평가는 AI 단계에서 별도 생성) */
export interface MarketBrief {
  date: string
  kospi: {
    value: string
    pct: number
    isUp: boolean
    diff: number // 전일 대비 등락폭(지수 포인트, 부호 있음)
    series: number[] // 스파크라인용 종가 배열 (과거 → 최근 순)
  }
  investorTrading: {
    individual: InvestorFlow
    foreigner: InvestorFlow
    institution: InvestorFlow
  }
  themes: ThemeBrief[] // returnPct 내림차순
  todayTheme: string // 오늘의 테마 = |returnPct|가 가장 큰 섹터. themes[].theme 중 하나
  news: Headline[] // 시장 전체 뉴스 후보 (marketEval 근거용)
  themeNews: Headline[] // 오늘의 테마 뉴스 후보 (카드 5에 실릴 3건을 여기서 고름)
}

/** AI가 후보 중 선별한 핵심 뉴스 */
export interface SelectedNews {
  title: string
  link?: string
  why: string // 오늘 시장/테마를 왜 움직였나 (AI)
}

/** AI 평가 결과 (MarketBrief를 입력으로) */
export interface MarketEval {
  marketEval: string // 오늘 코스피 시장 총평 (카드 2 하이라이트 박스 — 2줄 분량)
  themeComment: string // 오늘의 테마가 왜 그렇게 움직였는지 한 줄 (카드 4)
  news: SelectedNews[] // 오늘의 테마 뉴스 3건 (카드 5 상단)
  marketNews: SelectedNews[] // 시장 전체를 움직인 뉴스 2건 (카드 5 하단)
}
