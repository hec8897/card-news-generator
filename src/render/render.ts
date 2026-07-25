import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CardCopy } from '../types/card.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NATIVE_CARD = { width: 640, height: 800 }
const TARGET_CARD = { width: 1080, height: 1350 }
const SCALE = TARGET_CARD.width / NATIVE_CARD.width // 1.6875 — 640×800 카드를 1080×1350으로 캡처

const SLIDES = [
  { label: 'B1 Cover', file: '01-cover.png' },
  { label: 'B2 Indices', file: '02-indices.png' },
  { label: 'B3 Summary', file: '03-summary.png' },
  { label: 'B4 Stocks', file: '04-stocks.png' },
  { label: 'B5 Closing', file: '05-closing.png' },
]

// 브라우저 컨텍스트에서 실행 (Node API 사용 불가) — 타입은 Node가 실행 전 제거함
function applyCardCopy(cardCopy: CardCopy) {
  const setText = (slot: string, value: string) => {
    const el = document.querySelector(`[data-slot="${slot}"]`)
    if (el) el.textContent = value
  }
  const setDirection = (el: Element, isUp: boolean) => {
    el.classList.toggle('up-text', isUp)
    el.classList.toggle('down-text', !isUp)
  }
  const setPct = (slot: string, isUp: boolean, pct: number) => {
    const el = document.querySelector(`[data-slot="${slot}"]`)!
    el.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(pct)}%`
    setDirection(el, isUp)
  }

  setText('date', cardCopy.date)
  setText('coverSubtitle', cardCopy.coverSubtitle)

  setText('kospi.value', cardCopy.kospi.value)
  setPct('kospi.pct', cardCopy.kospi.isUp, cardCopy.kospi.pct)
  setText('kospi.changeAbs', cardCopy.kospi.isUp ? `+${cardCopy.kospi.pct}` : `-${cardCopy.kospi.pct}`)

  setText('kosdaq.value', cardCopy.kosdaq.value)
  setPct('kosdaq.pct', cardCopy.kosdaq.isUp, cardCopy.kosdaq.pct)

  setText('summary.lead', cardCopy.summaryLead)
  setText('summary.rest', cardCopy.summaryRest)

  cardCopy.picks.forEach((pick, i) => {
    setText(`picks.${i}.name`, pick.name)
    const badge = document.querySelector(`[data-slot="picks.${i}.pct"]`)!
    badge.textContent = `${pick.isUp ? '+' : '-'}${pick.pct}%`
    badge.classList.toggle('badge-up', pick.isUp)
    badge.classList.toggle('badge-down', !pick.isUp)
    const card = document.querySelector(`[data-pick="${i}"]`)!
    card.classList.toggle('pick-up', pick.isUp)
    card.classList.toggle('pick-down', !pick.isUp)
    setText(`picks.${i}.note`, pick.note)
  })

  setText('closingHeadline.line1', cardCopy.closingLine1)
  setText('closingHeadline.line2', cardCopy.closingLine2)
  setText('tomorrowPoint', cardCopy.tomorrowPoint)
}

export async function renderCards(
  cardCopy: CardCopy,
  { style = 'neon', outDir }: { style?: string; outDir: string },
): Promise<string[]> {
  if (style !== 'neon') {
    throw new Error(`render: 지원하지 않는 스타일 '${style}' (현재 neon만 지원)`)
  }
  const templatePath = path.join(__dirname, '..', '..', 'templates', `${style}.html`)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 3500, height: 900 } })
    await page.goto(`file://${templatePath}`)
    await page.evaluate(applyCardCopy, cardCopy)
    await page.evaluate(() => document.fonts.ready)

    const paths: string[] = []
    for (const slide of SLIDES) {
      const outPath = path.join(outDir, slide.file)
      await page.locator(`[data-label="${slide.label}"]`).screenshot({ path: outPath })
      paths.push(outPath)
    }
    return paths
  } finally {
    await browser.close()
  }
}
