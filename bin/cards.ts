#!/usr/bin/env node
// 테마 시황 카드 5장을 out/<날짜>/에 생성. 수집 → AI 평가 → 렌더까지 (메일 발송 없음).
// 사용: node bin/cards.ts [--brief <path>]
//       --brief를 주면 수집·AI를 건너뛰고 저장된 JSON으로 렌더만 (토스 IP 없이도 됨)
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { renderThemeCards } from '../src/render/theme.ts'
import type { MarketBrief, MarketEval } from '../src/types/market.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  // .env 없는 환경 — 무시
}

const args = process.argv.slice(2)
const briefIdx = args.indexOf('--brief')

let brief: MarketBrief
let evaluation: MarketEval

if (briefIdx !== -1) {
  // bin/brief.ts --eval 출력을 그대로 받는다 (brief와 eval이 한 객체로 병합된 형태)
  const merged = JSON.parse(readFileSync(args[briefIdx + 1]!, 'utf8'))
  brief = merged
  evaluation = { marketEval: merged.marketEval, themeComment: merged.themeComment, news: merged.news }
} else {
  const { collectMarketBrief } = await import('../src/collect/market.ts')
  const { evaluateBrief } = await import('../src/ai/evaluate.ts')
  brief = await collectMarketBrief()
  evaluation = await evaluateBrief(brief)
}

// 스타일별 하위 폴더 — neon 시안과 파일명이 겹쳐 서로 덮어쓴다
const outDir = path.join('out', brief.date, 'theme')
mkdirSync(outDir, { recursive: true })

const paths = await renderThemeCards(brief, evaluation, { outDir })
console.log(`완료: ${brief.date} 카드 ${paths.length}장 (오늘의 테마: ${brief.todayTheme})`)
paths.forEach((p) => console.log(`  ${p}`))
