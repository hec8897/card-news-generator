import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { collectDaily } from './collect/index.ts'
import { summarize } from './summarize.ts'
import { renderCards } from './render/render.ts'
import { sendCardNewsMail } from './notify.ts'
import type { CardCopy, Config, DailyData, PipelineOpts, Summary } from './types.ts'

function formatCardDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(date)
  return `${y}.${m}.${d} · ${weekday}`
}

function outDirFor(date: Date): string {
  const dir = path.join('out', date.toISOString().slice(0, 10))
  mkdirSync(dir, { recursive: true })
  return dir
}

function assembleCardCopy(dailyData: DailyData, summary: Summary): CardCopy {
  const kr = dailyData.kr
  const picks = summary.picks.map((p) => {
    const match = kr.watchlist.find((w) => w.code === p.code) ?? kr.watchlist[0]
    return { name: match.name, pct: match.pct, isUp: match.isUp, note: p.note }
  })

  return {
    date: formatCardDate(dailyData.date),
    coverSubtitle: summary.coverSubtitle,
    kospi: kr.kospi,
    kosdaq: kr.kosdaq,
    summaryLead: summary.summaryLead,
    summaryRest: summary.summaryRest,
    picks,
    closingLine1: summary.closingLine1,
    closingLine2: summary.closingLine2,
    tomorrowPoint: summary.tomorrowPoint,
  }
}

export async function runPipeline(config: Config, opts: PipelineOpts = {}) {
  const dailyData = await collectDaily(opts)
  const summary = await summarize(dailyData, opts)
  const cardCopy = assembleCardCopy(dailyData, summary)
  const pngPaths = await renderCards(cardCopy, {
    style: opts.style ?? config.STYLE,
    outDir: outDirFor(dailyData.date),
  })
  const mailOptions = await sendCardNewsMail(cardCopy, pngPaths, { warnings: dailyData.warnings, demo: opts.demo })
  return { cardCopy, pngPaths, mailOptions, warnings: dailyData.warnings }
}
