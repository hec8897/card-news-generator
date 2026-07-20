#!/usr/bin/env node
import { runPipeline } from '../src/pipeline.ts'
import { config } from '../src/config.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  // .env 없음 (예: GitHub Actions처럼 환경변수를 직접 주입하는 환경) — 무시
}

function argFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const args = process.argv.slice(2)
const style = argFlag(args, '--style')
const demo = args.includes('--demo')

const result = await runPipeline(config, { style, demo })

console.log(`완료: PNG ${result.pngPaths.length}장 생성, 메일 ${demo ? '(demo, 미발송)' : '발송 완료'}`)
if (result.warnings.length) console.warn('경고:', result.warnings.join(' / '))
