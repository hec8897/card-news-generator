#!/usr/bin/env node
// 테마별 시총 TOP N 조회 (기본: 코스피, top3). 카드뉴스 테마 기능의 베이스.
// 사용: node bin/themes.ts [--top 3] [--market KOSPI]
import { collectThemeCaps } from '../src/collect/themes.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  // .env 없는 환경(환경변수 직접 주입) — 무시
}

function argFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const args = process.argv.slice(2)
const topN = Number(argFlag(args, '--top') ?? 3)
const market = argFlag(args, '--market') ?? 'KOSPI'

const won = (n: number) => (n / 1e12).toFixed(1) + '조'

const results = await collectThemeCaps(undefined, { topN, market })
for (const { theme, stocks } of results) {
  console.log(`\n【${theme}】 ${market} 시총 TOP${topN}`)
  stocks.forEach((s, i) => console.log(`  ${i + 1}. ${s.name.padEnd(12)} ${won(s.cap).padStart(9)}`))
  if (stocks.length < topN) console.log(`  (${market} 상장 후보 부족)`)
}
