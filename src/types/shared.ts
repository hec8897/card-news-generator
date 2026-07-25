import type OpenAI from 'openai'

/** 지수·종목 공통 시세 */
export interface Quote {
  code: string
  name: string
  value: string // 천단위 콤마 포함 문자열
  pct: number // 등락률 절댓값
  isUp: boolean
}

export interface Headline {
  title?: string
  link?: string
  pubDate?: string
  description?: string // 기사 요약 (AI 선별용)
}

export interface Config {
  STYLE: string
}

export interface CollectOpts {
  demo?: boolean
  limit?: number
  queries?: string[] // 뉴스 검색어 (기본: news.ts의 NEWS_QUERIES)
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
