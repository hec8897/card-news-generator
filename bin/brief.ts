#!/usr/bin/env node
// 시장 종합 데이터를 JSON으로 출력 (카드뉴스 새 템플릿 베이스).
// 사용: node bin/brief.ts          → 데이터만
//       node bin/brief.ts --eval   → 데이터 + AI 평가(시장총평·핵심뉴스 선별)
import { collectMarketBrief } from '../src/collect/market.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  /* .env 없는 환경 — 무시 */
}

const brief = await collectMarketBrief()

if (process.argv.includes('--eval')) {
  const { evaluateBrief } = await import('../src/ai/evaluate.ts')
  const evaluation = await evaluateBrief(brief)
  // AI 선별 뉴스로 news를 교체하고 marketEval 추가
  console.log(JSON.stringify({ ...brief, news: evaluation.news, marketEval: evaluation.marketEval }, null, 2))
} else {
  console.log(JSON.stringify(brief, null, 2))
}
