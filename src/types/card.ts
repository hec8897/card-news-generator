// 구 발행 경로(collect/legacy-kr.ts → ai/summarize.ts → render/neon.html)의 어휘.
// design/의 새 테마 카드로 교체되면 이 파일과 legacy-kr.ts, summarize.ts가 함께 사라진다.
import type { Headline, Quote } from './shared.ts'

export interface KrData {
  kospi: Quote
  kosdaq: Quote
  watchlist: Quote[] // 거래대금 상위 종목
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
