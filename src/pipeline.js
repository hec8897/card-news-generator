// src/pipeline.js
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { collectDaily } from './collect/index.js'
import { summarize } from './summarize.js'
import { renderCards } from './render/render.js'
import { sendCardNewsMail } from './notify.js'

function formatCardDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(date)
  return `${y}.${m}.${d} · ${weekday}`
}

function outDirFor(date) {
  const dir = path.join('out', date.toISOString().slice(0, 10))
  mkdirSync(dir, { recursive: true })
  return dir
}

function assembleCardCopy(dailyData, summary) {
  const kr = dailyData.kr
  if (!kr) throw new Error('pipeline: 한국 시황 데이터 없이는 카드를 만들 수 없음')
  const us = dailyData.us

  const picks = summary.picks.map((p) => {
    const match = kr.watchlist.find((w) => w.code === p.code) ?? kr.watchlist[0]
    return { name: match.name, pct: match.pct, isUp: match.isUp, note: p.note }
  })

  return {
    date: formatCardDate(dailyData.date),
    coverSubtitle: summary.coverSubtitle,
    kospi: kr.kospi,
    kosdaq: kr.kosdaq,
    nasdaq: us ? us.nasdaq : { value: '-', pct: 0, isUp: true },
    summaryLead: summary.summaryLead,
    summaryRest: summary.summaryRest,
    picks,
    closingLine1: summary.closingLine1,
    closingLine2: summary.closingLine2,
    tomorrowPoint: summary.tomorrowPoint,
  }
}

export async function runPipeline(config, opts = {}) {
  const dailyData = await collectDaily(config, opts)
  const summary = await summarize(dailyData, opts)
  const cardCopy = assembleCardCopy(dailyData, summary)
  const pngPaths = await renderCards(cardCopy, {
    style: opts.style ?? config.STYLE,
    outDir: outDirFor(dailyData.date),
  })
  const mailOptions = await sendCardNewsMail(cardCopy, pngPaths, { warnings: dailyData.warnings, demo: opts.demo })
  return { cardCopy, pngPaths, mailOptions, warnings: dailyData.warnings }
}
