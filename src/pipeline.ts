import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { collectMarketBrief } from './collect/market.ts'
import { evaluateBrief } from './ai/evaluate.ts'
import { renderThemeCards } from './render/theme.ts'
import { sendThemeMail } from './notify.ts'
import type { PipelineOpts } from './types/shared.ts'

function outDirFor(date: string): string {
  const dir = path.join('out', date, 'theme')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 매일 발행: 테마 시황 수집 → AI 평가 → 카드 5장 렌더 → 메일 발송. */
export async function runPipeline(opts: PipelineOpts = {}) {
  const brief = await collectMarketBrief()
  const evaluation = await evaluateBrief(brief, opts)
  const pngPaths = await renderThemeCards(brief, evaluation, { outDir: outDirFor(brief.date) })
  const mailOptions = await sendThemeMail(brief, evaluation, pngPaths, { demo: opts.demo })
  return { brief, evaluation, pngPaths, mailOptions }
}
