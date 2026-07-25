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
  // 평가 결과를 통째로 병합 — evaluation.news(테마 뉴스 3건)가 후보 목록을 덮어쓴다
  console.log(JSON.stringify({ ...brief, ...evaluation }, null, 2))
} else {
  console.log(JSON.stringify(brief, null, 2))
}
