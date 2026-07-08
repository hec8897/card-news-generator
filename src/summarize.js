import Anthropic from '@anthropic-ai/sdk'

const TOOL_NAME = 'emit_card_copy'

const CARD_COPY_TOOL = {
  name: TOOL_NAME,
  description: '카드뉴스에 들어갈 한국어 카피를 생성한다',
  input_schema: {
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
            code: { type: 'string', description: '왓치리스트 종목 코드 중 하나' },
            note: { type: 'string', description: '해당 종목에 대한 한 줄 코멘트' },
          },
          required: ['code', 'note'],
        },
      },
      closingLine1: { type: 'string' },
      closingLine2: { type: 'string' },
      tomorrowPoint: { type: 'string' },
    },
    required: ['coverSubtitle', 'summaryLead', 'summaryRest', 'picks', 'closingLine1', 'closingLine2', 'tomorrowPoint'],
  },
}

const SYSTEM_PROMPT = `너는 인스타그램 주식뉴스 계정 '@마켓노트'의 카피라이터야.
간결하고 신뢰감 있는 한국어 톤으로 쓰고, 과장하거나 투자를 권유하지 마.
이 카드는 정보 요약이지 투자 조언이 아니야.`

export async function summarize(dailyData, { client } = {}) {
  const anthropic = client ?? new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [CARD_COPY_TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: JSON.stringify(dailyData) }],
  })
  const toolUse = message.content.find((b) => b.type === 'tool_use')
  if (!toolUse) throw new Error('summarize: 모델이 구조화 출력을 반환하지 않음')
  return toolUse.input
}
