import OpenAI from 'openai'
import type { MarketBrief, MarketEval, SelectedNews } from '../types/market.ts'

const SCHEMA_NAME = 'emit_market_eval'

const SCHEMA = {
  type: 'object',
  properties: {
    marketEval: {
      type: 'string',
      description:
        '오늘 코스피 시장 총평. 카드에 2줄로 들어가므로 90자 이내 2문장. 지수 등락과 투자자 수급을 엮어서. 과장/투자권유 금지.',
    },
    themeComment: {
      type: 'string',
      description:
        '오늘의 테마(todayTheme)가 왜 그렇게 움직였는지 한 문장, 45자 이내. 테마 뉴스에 근거를 두되 기사 제목을 그대로 옮기지 말 것.',
    },
    news: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      description: '오늘의 테마 뉴스 후보 중 그 테마를 실제로 움직인 핵심 3건. 정치·행사·홍보성 잡음 제외.',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'themeNewsCandidates 배열의 인덱스(0부터)' },
          why: { type: 'string', description: '이 뉴스가 오늘 해당 테마에 왜 중요했는지 한 줄, 50자 이내' },
        },
        required: ['index', 'why'],
        additionalProperties: false,
      },
    },
    marketNews: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      description: '시장 전체를 움직인 핵심 뉴스 2건 (지수·수급·거시·정책). marketNewsCandidates에서 고르고, 테마 뉴스와 중복 피할 것. 정치·행사·홍보성 잡음 제외.',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'marketNewsCandidates 배열의 인덱스(0부터)' },
          why: { type: 'string', description: '이 뉴스가 오늘 시장 전체에 왜 중요했는지 한 줄, 50자 이내' },
        },
        required: ['index', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['marketEval', 'themeComment', 'news', 'marketNews'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `너는 인스타그램 주식뉴스 계정 '@money.updown'의 애널리스트야.
오늘 코스피 시장을 냉정하고 간결하게 평가하고, 뉴스 후보 중 시장·테마를 실제로 움직인 핵심만 골라.
정치/지자체/행사/홍보성 기사는 제외. 과장하거나 투자를 권유하지 마. 이건 정보 요약이지 투자 조언이 아니야.`

const jo = (n: number) => Number((n / 1e12).toFixed(2)) // 원 → 조원

export async function evaluateBrief(brief: MarketBrief, { client }: { client?: OpenAI } = {}): Promise<MarketEval> {
  const openai = client ?? new OpenAI()

  const input = {
    date: brief.date,
    kospi: brief.kospi,
    investorNet조원: {
      // 순매수(+)/순매도(-)
      개인: jo(brief.investorTrading.individual.net),
      외국인: jo(brief.investorTrading.foreigner.net),
      기관: jo(brief.investorTrading.institution.net),
    },
    themes: brief.themes.map((t) => ({
      theme: t.theme,
      returnPct: t.returnPct,
      top3: t.top3.map((s) => ({ name: s.name, pct: s.pct })),
    })),
    todayTheme: brief.todayTheme,
    themeNewsCandidates: brief.themeNews.map((n, i) => ({ index: i, title: n.title, description: n.description })),
    marketNewsCandidates: brief.news.map((n, i) => ({ index: i, title: n.title, description: n.description })),
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) },
    ],
    response_format: { type: 'json_schema', json_schema: { name: SCHEMA_NAME, schema: SCHEMA, strict: true } },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('evaluate: 모델이 구조화 출력을 반환하지 않음')
  const out = JSON.parse(content) as {
    marketEval: string
    themeComment: string
    news: { index: number; why: string }[]
    marketNews: { index: number; why: string }[]
  }

  // AI가 고른 인덱스를 원본 후보(제목·링크)에 매핑 — URL 환각 방지
  const pick = (picks: { index: number; why: string }[], pool: MarketBrief['news']): SelectedNews[] =>
    picks
      .map(({ index, why }): SelectedNews | null => {
        const cand = pool[index]
        if (!cand) return null
        return { title: cand.title ?? '', link: cand.link, why }
      })
      .filter((n): n is SelectedNews => n !== null)

  return {
    marketEval: out.marketEval,
    themeComment: out.themeComment,
    news: pick(out.news, brief.themeNews),
    marketNews: pick(out.marketNews, brief.news),
  }
}
