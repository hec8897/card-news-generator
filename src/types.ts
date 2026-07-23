import type OpenAI from 'openai'

/** 지수·종목 공통 시세 */
export interface Quote {
  code: string
  name: string
  value: string // 천단위 콤마 포함 문자열
  pct: number // 등락률 절댓값
  isUp: boolean
}

export interface KrData {
  kospi: Quote
  kosdaq: Quote
  watchlist: Quote[] // 거래대금 상위 종목
}

export interface Headline {
  title?: string
  link?: string
  pubDate?: string
  description?: string // 기사 요약 (AI 선별용)
}

export interface DailyData {
  date: Date
  kr: KrData
  headlines: Headline[]
  warnings: string[]
}

/** OpenAI 구조화 출력 (숫자는 AI가 만들지 않음 — code로 종목만 선택) */
export interface Summary {
  coverSubtitle: string
  summaryLead: string
  summaryRest: string
  picks: { code: string; note: string }[]
  closingLine1: string
  closingLine2: string
  tomorrowPoint: string
}

export interface CardPick {
  name: string
  pct: number
  isUp: boolean
  note: string
}

/** 렌더 템플릿에 주입되는 최종 카드 문구 */
export interface CardCopy {
  date: string
  coverSubtitle: string
  kospi: Quote
  kosdaq: Quote
  summaryLead: string
  summaryRest: string
  picks: CardPick[]
  closingLine1: string
  closingLine2: string
  tomorrowPoint: string
}

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

/** 투자자별 거래대금 (원). net = 순매수(매수-매도) */
export interface InvestorFlow {
  buy: number
  sell: number
  net: number
}

export interface ThemeBrief {
  theme: string
  returnPct: number // 시총 가중 평균 등락률 %
  top3: ThemeCap[] // 시총 상위 3 (각 종목 일일 등락률 포함)
}

/** AI가 후보 중 선별한 핵심 뉴스 */
export interface SelectedNews {
  title: string
  link?: string
  why: string // 오늘 시장/테마를 왜 움직였나 (AI)
}

/** AI 평가 결과 (MarketBrief를 입력으로) */
export interface MarketEval {
  marketEval: string // 오늘 코스피 시장 총평
  news: SelectedNews[] // 선별된 핵심 뉴스
}

/** 카드뉴스용 시장 종합 데이터 (시장 평가는 AI 단계에서 별도 생성) */
export interface MarketBrief {
  date: string
  kospi: { value: string; pct: number; isUp: boolean }
  investorTrading: {
    individual: InvestorFlow
    foreigner: InvestorFlow
    institution: InvestorFlow
  }
  themes: ThemeBrief[]
  news: Headline[]
}

export interface Config {
  STYLE: string
}

export interface CollectOpts {
  demo?: boolean
  limit?: number
  queries?: string[] // 뉴스 검색어 (기본: 시장 키워드). 테마명 넣으면 테마 뉴스까지 후보에 포함
}

export interface PipelineOpts {
  demo?: boolean
  style?: string
  client?: OpenAI // summarize용 주입 (테스트)
}

export interface NotifyOpts {
  warnings?: string[]
  to?: string
  demo?: boolean
}
