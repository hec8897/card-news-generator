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

export interface Config {
  STYLE: string
}

export interface CollectOpts {
  demo?: boolean
  limit?: number
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
