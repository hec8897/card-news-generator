import OpenAI from 'openai'
import type { DailyData, Summary } from '../types/card.ts'

const SCHEMA_NAME = 'emit_card_copy'

const CARD_COPY_SCHEMA = {
  type: 'object',
  properties: {
    coverSubtitle: { type: 'string', description: '커버 슬라이드 한 줄 소개' },
    summaryLead: { type: 'string', description: '시황 요약 강조 문구 (굵게 표시됨)' },
    summaryRest: { type: 'string', description: '시황 요약 나머지 문장' },
    picks: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '오늘 거래대금 상위 종목 중 하나의 코드' },
          note: { type: 'string', description: '해당 종목에 대한 한 줄 코멘트' },
        },
        required: ['code', 'note'],
        additionalProperties: false,
      },
    },
    closingLine1: { type: 'string' },
    closingLine2: { type: 'string' },
    tomorrowPoint: { type: 'string' },
  },
  required: ['coverSubtitle', 'summaryLead', 'summaryRest', 'picks', 'closingLine1', 'closingLine2', 'tomorrowPoint'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `너는 인스타그램 주식뉴스 계정 '@마켓노트'의 카피라이터야.
간결하고 신뢰감 있는 한국어 톤으로 쓰고, 과장하거나 투자를 권유하지 마.
이 카드는 정보 요약이지 투자 조언이 아니야.`

export async function summarize(dailyData: DailyData, { client }: { client?: OpenAI } = {}): Promise<Summary> {
  const openai = client ?? new OpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(dailyData) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: SCHEMA_NAME, schema: CARD_COPY_SCHEMA, strict: true },
    },
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('summarize: 모델이 구조화 출력을 반환하지 않음')
  return JSON.parse(content) as Summary
}
