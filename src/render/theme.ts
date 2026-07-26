// 테마 시황 카드(templates/theme.html) 렌더러. 구 경로의 render.ts와 별개 — 입력 타입이 다르다.
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MarketBrief, MarketEval } from '../types/market.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NATIVE_CARD = { width: 640, height: 800 }
const TARGET_CARD = { width: 1080, height: 1350 }
const SCALE = TARGET_CARD.width / NATIVE_CARD.width // 1.6875

const SLIDES = [
  { label: 'T1 Cover', file: '01-cover.png' },
  { label: 'T2 KOSPI', file: '02-kospi.png' },
  { label: 'T3 테마 랭킹', file: '03-themes.png' },
  { label: 'T4 오늘의 테마', file: '04-today.png' },
  { label: 'T5 섹터 뉴스', file: '05-news.png' },
]

/** 템플릿 슬롯에 그대로 꽂히는 형태. 포맷팅은 전부 Node에서 끝내고 브라우저엔 문자열만 넘긴다. */
interface ThemeCardCopy {
  date: string
  kospi: { value: string; pct: string; diff: string; isUp: boolean; series: number[] }
  flows: { label: 'individual' | 'foreigner' | 'institution'; text: string; sign: number }[]
  themes: { rank: string; name: string; pct: string; sign: number }[] // 노출되는 행만 (상위 3 + 하위 2)
  hasSkipped: boolean // 가운데 생략 표시(세로 점 3개)를 띄울지
  today: { name: string; pct: string; sign: number; comment: string; stocks: { name: string; pct: string; sign: number }[] }
  news: { title: string; why: string }[]
  marketEval: string
}

const pctText = (p: number) => `${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(2)}%`
const signedPct = (p: number) => `${p >= 0 ? '+' : '-'}${Math.abs(p).toFixed(2)}%`
const jo = (won: number) => `${won >= 0 ? '+' : '-'}${Math.abs(won / 1e12).toFixed(2)}조`

function formatCardDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d).toUpperCase()
  return `${iso.replace(/-/g, '.')} ${weekday}`
}

const TOP_ROWS = 3 // 상승 상위
const BOTTOM_ROWS = 2 // 하락 하위

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * 랭킹은 상위 3 + 하위 2만 노출하고 중간은 생략한다.
 * 오늘의 테마는 |returnPct| 최대라 정렬상 항상 1위 아니면 꼴찌 — 즉 생략 구간에 숨지 않는다.
 */
function pickThemeRows(themes: MarketBrief['themes']) {
  const row = (t: MarketBrief['themes'][number], rank: number) => ({
    rank: pad2(rank),
    name: t.theme,
    pct: signedPct(t.returnPct),
    sign: Math.sign(t.returnPct),
  })
  if (themes.length <= TOP_ROWS + BOTTOM_ROWS) {
    return { rows: themes.map((t, i) => row(t, i + 1)), hasSkipped: false }
  }
  const to = themes.length - BOTTOM_ROWS
  return {
    rows: [
      ...themes.slice(0, TOP_ROWS).map((t, i) => row(t, i + 1)),
      ...themes.slice(-BOTTOM_ROWS).map((t, i) => row(t, to + 1 + i)),
    ],
    hasSkipped: true,
  }
}

export function toThemeCardCopy(brief: MarketBrief, evaluation: MarketEval): ThemeCardCopy {
  const today = brief.themes.find((t) => t.theme === brief.todayTheme) ?? brief.themes[0]
  const flow = brief.investorTrading
  const ranking = pickThemeRows(brief.themes)
  return {
    date: formatCardDate(brief.date),
    kospi: {
      value: brief.kospi.value,
      pct: pctText(brief.kospi.pct),
      diff: `${brief.kospi.diff >= 0 ? '+' : ''}${brief.kospi.diff}`,
      isUp: brief.kospi.isUp,
      series: brief.kospi.series,
    },
    flows: [
      { label: 'individual', text: jo(flow.individual.net), sign: Math.sign(flow.individual.net) },
      { label: 'foreigner', text: jo(flow.foreigner.net), sign: Math.sign(flow.foreigner.net) },
      { label: 'institution', text: jo(flow.institution.net), sign: Math.sign(flow.institution.net) },
    ],
    themes: ranking.rows,
    hasSkipped: ranking.hasSkipped,
    today: {
      name: today.theme,
      pct: signedPct(today.returnPct),
      sign: Math.sign(today.returnPct),
      comment: evaluation.themeComment,
      stocks: today.top3.map((s) => ({ name: s.name, pct: signedPct(s.pct), sign: Math.sign(s.pct) })),
    },
    // 테마 뉴스 3 + 시장 뉴스 2 = 5 (템플릿 news.0~2 = 테마, news.3~4 = 시장)
    news: [...evaluation.news, ...evaluation.marketNews].map((n) => ({ title: n.title, why: n.why })),
    marketEval: evaluation.marketEval,
  }
}

// 브라우저 컨텍스트에서 실행 (Node API 사용 불가) — 타입은 Node가 실행 전 제거함
function applyThemeCards(copy: ThemeCardCopy) {
  const q = (slot: string) => document.querySelector(`[data-slot="${slot}"]`)
  const setText = (slot: string, value: string) => {
    const el = q(slot)
    if (el) el.textContent = value
  }
  const setDir = (el: Element | null, sign: number, sub = false) => {
    if (!el) return
    el.classList.remove('up-text', 'down-text', 'flat-text', 'up-sub', 'down-sub')
    if (sub) el.classList.add(sign >= 0 ? 'up-sub' : 'down-sub')
    else el.classList.add(sign > 0 ? 'up-text' : sign < 0 ? 'down-text' : 'flat-text')
  }
  const setTextDir = (slot: string, value: string, sign: number, sub = false) => {
    setText(slot, value)
    setDir(q(slot), sign, sub)
  }

  const kospiSign = copy.kospi.isUp ? 1 : -1

  // 1. Cover
  setTextDir('cover.kospi.value', copy.kospi.value, kospiSign)
  setTextDir('cover.kospi.pct', copy.kospi.pct, kospiSign)
  setText('date', copy.date)

  // 2. KOSPI
  setText('kospi.value', copy.kospi.value)
  setTextDir('kospi.pct', copy.kospi.pct, kospiSign)
  setTextDir('kospi.diff', copy.kospi.diff, kospiSign, true)
  const box = document.querySelector('[data-slot-box="kospi"]')
  if (box) {
    box.classList.toggle('box-up', copy.kospi.isUp)
    box.classList.toggle('box-down', !copy.kospi.isUp)
  }

  // 스파크라인 — viewBox 400×100에 종가를 정규화
  const W = 400
  const H = 100
  const PAD = 8
  const s = copy.kospi.series
  if (s.length > 1) {
    const min = Math.min(...s)
    const max = Math.max(...s)
    const span = max - min || 1
    const pts = s.map((v, i) => {
      const x = (i / (s.length - 1)) * W
      const y = PAD + (1 - (v - min) / span) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    const stroke = copy.kospi.isUp ? '#2bd576' : '#ff5a5a'
    const fill = copy.kospi.isUp ? 'rgba(43,213,118,0.14)' : 'rgba(255,90,90,0.14)'
    const line = document.querySelector('[data-spark="line"]')
    if (line) {
      line.setAttribute('points', pts.join(' '))
      line.setAttribute('stroke', stroke)
    }
    const area = document.querySelector('[data-spark="area"]')
    if (area) {
      area.setAttribute('d', `M${pts.join(' L')} L${W},${H} L0,${H} Z`)
      area.setAttribute('fill', fill)
    }
  }

  copy.flows.forEach((f) => setTextDir(`flow.${f.label}`, f.text, f.sign))
  setText('marketEval', copy.marketEval)

  // 3. 테마 랭킹 — 노출 행만 채우고, 남는 행은 숨긴다(테마가 5개 이하인 경우)
  document.querySelectorAll('[data-theme-row]').forEach((row) => {
    const i = Number((row as HTMLElement).dataset.themeRow)
    const t = copy.themes[i]
    if (!t) {
      ;(row as HTMLElement).style.display = 'none'
      return
    }
    setText(`themes.${i}.rank`, t.rank)
    setText(`themes.${i}.name`, t.name)
    setTextDir(`themes.${i}.pct`, t.pct, t.sign)
    row.classList.remove('row-up', 'row-down', 'row-flat')
    row.classList.add(t.sign > 0 ? 'row-up' : t.sign < 0 ? 'row-down' : 'row-flat')
  })
  const skipRow = document.querySelector('[data-skip-row]') as HTMLElement | null
  if (skipRow) {
    if (!copy.hasSkipped) skipRow.style.display = 'none'
  }

  // 4. 오늘의 테마
  setText('today.label', copy.today.name)
  setText('today.name', copy.today.name)
  setTextDir('today.pct', copy.today.pct, copy.today.sign)
  setText('today.comment', copy.today.comment)
  copy.today.stocks.forEach((st, i) => {
    setText(`today.stocks.${i}.name`, st.name)
    setTextDir(`today.stocks.${i}.pct`, st.pct, st.sign)
  })

  // 5. 섹터 뉴스
  copy.news.forEach((n, i) => {
    setText(`news.${i}.title`, n.title)
    setText(`news.${i}.why`, n.why)
  })
}

export async function renderThemeCards(
  brief: MarketBrief,
  evaluation: MarketEval,
  { outDir }: { outDir: string },
): Promise<string[]> {
  const copy = toThemeCardCopy(brief, evaluation)
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'theme.html')
  const browser = await chromium.launch()
  try {
    // 카드가 세로로 쌓여 있어 뷰포트는 한 장 크기로 충분 — element screenshot이 스크롤한다
    const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 760, height: 900 } })
    await page.goto(`file://${templatePath}`)
    await page.evaluate(applyThemeCards, copy)
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
