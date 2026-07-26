#!/usr/bin/env node
import { runPipeline } from '../src/pipeline.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  // .env 없음 (예: GitHub Actions처럼 환경변수를 직접 주입하는 환경) — 무시
}

const demo = process.argv.slice(2).includes('--demo')

const result = await runPipeline({ demo })

console.log(
  `완료: 테마 카드 ${result.pngPaths.length}장 · 오늘의 테마 ${result.brief.todayTheme} · 메일 ${demo ? '(demo, 미발송)' : '발송 완료'}`,
)
