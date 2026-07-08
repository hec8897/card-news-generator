# 매일 아침 메일 발송 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 국내/미국 시황 + 종목픽을 수집 → AI로 카피를 생성 → `templates/neon.html` 기반 PNG 카드 4장을 렌더 → 네이버 메일로 본인에게 발송하는 CLI 파이프라인을 만든다.

**Architecture:** `collect (KR/US/뉴스) → summarize (Anthropic 구조화 출력) → assembleCardCopy (숫자는 수집 데이터, 문구는 AI) → render (Playwright 스크린샷) → notify (nodemailer)`. 각 단계는 독립 모듈, `pipeline.js`가 순서대로 호출. 인스타 자동 업로드(Phase 2)는 이번 범위 밖.

**Tech Stack:** Node.js (ESM, `"type": "module"`), `@anthropic-ai/sdk`, `playwright`(chromium), `yahoo-finance2`, `rss-parser`, `nodemailer`, 테스트는 `node --test`(프레임워크 없음).

## Global Constraints

- Node.js >= 20.6 (native `fetch`, `process.loadEnvFile`) — package.json의 `engines.node`에 명시.
- 전 파일 ESM(`import`/`export`), CommonJS 금지.
- 새 의존성은 아래 5개로 제한: `@anthropic-ai/sdk`, `playwright`, `yahoo-finance2`, `rss-parser`, `nodemailer`. 그 외(axios, dotenv, cheerio 등) 추가 금지 — 각각 native fetch/`process.loadEnvFile`/watchlist 기반 조회로 대체됨.
- 테스트는 `node:test` + `node:assert`만 사용, 별도 프레임워크 설치 금지.
- 모델: `claude-opus-4-8` 고정.
- 스타일: 이번 범위에서 `neon` 템플릿만 지원 (`STYLE=neon` 기본값, 다른 값이면 명확한 에러로 실패).
- 인스타그램 발행(`publish.js`)은 만들지 않는다 — 이번 라운드 범위 아님.

---

## 참고: 실제 API 응답 형태 (구현 전 curl로 확인 완료)

**Naver 지수/종목 폴링** — `https://polling.finance.naver.com/api/realtime/domestic/{index|stock}/{codes}` (콤마 구분, 무키):

```json
{"datas":[{"itemCode":"KOSPI","stockName":"코스피","closePrice":"7,246.79","fluctuationsRatio":"-5.35", "...": "..."}]}
```

- `fluctuationsRatio`는 부호 포함 문자열(`"-5.35"` 또는 `"0.82"`) → `parseFloat`으로 부호 판별.
- 종목도 동일 엔드포인트의 `stock` 타입으로 조회 가능 (예: `005930,000660`).
- **원/달러 환율 엔드포인트는 존재하지 않음/구형**이라 확인 실패 → 이번 라운드는 환율 대신 이미 수집하는 **나스닥**을 지수 슬라이드 2번째 박스에 표시 (아래 템플릿 편집 참고).

**뉴스 RSS** — `https://www.mk.co.kr/rss/50200011/` (매일경제 증권, 무키) 확인 완료. 표준 RSS 2.0(`title`/`link`/`pubDate`/`description`).

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`
- Create: `.env.example`

**Interfaces:**
- Produces: `npm run publish`, `npm test` 스크립트. 이후 모든 태스크가 이 의존성들을 사용.

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "card-news-generator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.6" },
  "scripts": {
    "publish": "node bin/publish.js",
    "test": "node --test"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "nodemailer": "^6.9.0",
    "playwright": "^1.47.0",
    "rss-parser": "^3.13.0",
    "yahoo-finance2": "^2.13.0"
  }
}
```

- [ ] **Step 2: `.env.example` 작성**

```
ANTHROPIC_API_KEY=
NAVER_EMAIL=
NAVER_APP_PASSWORD=
MAIL_TO=hec8897@naver.com
STYLE=neon
```

- [ ] **Step 3: 의존성 설치 + Playwright 브라우저 설치**

Run: `npm install && npx playwright install chromium`
Expected: `node_modules/` 생성, chromium 다운로드 완료 로그.

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: 프로젝트 스캐폴드 + 의존성"
```

---

### Task 2: `src/config.js`

**Files:**
- Create: `src/config.js`
- Test: `src/config.test.js`

**Interfaces:**
- Produces: `config.STYLE: string`, `config.KR_WATCHLIST: {code: string, name: string}[]` — Task 5(collect/kr), Task 9(render), Task 11(pipeline)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/config.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config } from './config.js'

test('기본 STYLE은 neon', () => {
  assert.equal(config.STYLE, 'neon')
})

test('KR_WATCHLIST는 code/name을 가진 5개 종목', () => {
  assert.equal(config.KR_WATCHLIST.length, 5)
  for (const item of config.KR_WATCHLIST) {
    assert.equal(typeof item.code, 'string')
    assert.equal(typeof item.name, 'string')
  }
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/config.test.js`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 3: 구현**

```js
// src/config.js
export const config = {
  STYLE: process.env.STYLE || 'neon',
  KR_WATCHLIST: [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '035420', name: 'NAVER' },
    { code: '035720', name: '카카오' },
    { code: '247540', name: '에코프로비엠' },
  ],
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/config.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/config.js src/config.test.js
git commit -m "feat: config.js 추가"
```

---

### Task 3: `src/collect/us.js`

**Files:**
- Create: `src/collect/us.js`
- Test: `src/collect/us.test.js`

**Interfaces:**
- Consumes: `yahoo-finance2`의 `yahooFinance.quote(symbols: string[])`.
- Produces: `collectUs({demo}) => Promise<{sp500, nasdaq, dow}>` 각 항목은 `{value: string, pct: string, isUp: boolean}`. Task 6(collect/index), Task 11(pipeline)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (demo 모드, 네트워크 없음)**

```js
// src/collect/us.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectUs } from './us.js'

test('demo 모드는 네트워크 없이 sp500/nasdaq/dow를 반환', async () => {
  const result = await collectUs({ demo: true })
  for (const key of ['sp500', 'nasdaq', 'dow']) {
    assert.equal(typeof result[key].value, 'string')
    assert.equal(typeof result[key].isUp, 'boolean')
  }
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/collect/us.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/collect/us.js
import yahooFinance from 'yahoo-finance2'

const TICKERS = { sp500: '^GSPC', nasdaq: '^IXIC', dow: '^DJI' }

function toQuote(q) {
  const pct = q.regularMarketChangePercent
  return {
    value: q.regularMarketPrice.toLocaleString('en-US'),
    pct: Math.abs(pct).toFixed(2),
    isUp: pct >= 0,
  }
}

export function demoUs() {
  return {
    sp500: { value: '5,432.10', pct: '0.45', isUp: true },
    nasdaq: { value: '17,890.55', pct: '0.34', isUp: true },
    dow: { value: '39,120.00', pct: '0.12', isUp: false },
  }
}

export async function collectUs({ demo = false } = {}) {
  if (demo) return demoUs()
  const symbols = Object.values(TICKERS)
  const quotes = await yahooFinance.quote(symbols)
  const bySymbol = Object.fromEntries(quotes.map((q) => [q.symbol, q]))
  return {
    sp500: toQuote(bySymbol['^GSPC']),
    nasdaq: toQuote(bySymbol['^IXIC']),
    dow: toQuote(bySymbol['^DJI']),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/collect/us.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/collect/us.js src/collect/us.test.js
git commit -m "feat: 미국 시황 수집(collect/us) 추가"
```

---

### Task 4: `src/collect/kr.js`

**Files:**
- Create: `src/collect/kr.js`
- Test: `src/collect/kr.test.js`

**Interfaces:**
- Consumes: native `fetch`, `config.KR_WATCHLIST` (Task 2의 `{code,name}[]`).
- Produces: `collectKr(watchlist, {demo}) => Promise<{kospi, kosdaq, watchlist}>`. `kospi`/`kosdaq`은 `{value, pct, isUp}`, `watchlist`는 `{code, name, value, pct, isUp}[]`. Task 6, Task 11에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/collect/kr.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectKr } from './kr.js'
import { config } from '../config.js'

test('demo 모드는 네트워크 없이 kospi/kosdaq/watchlist를 반환', async () => {
  const result = await collectKr(config.KR_WATCHLIST, { demo: true })
  assert.equal(typeof result.kospi.value, 'string')
  assert.equal(typeof result.kosdaq.isUp, 'boolean')
  assert.equal(result.watchlist.length, config.KR_WATCHLIST.length)
  assert.equal(result.watchlist[0].code, config.KR_WATCHLIST[0].code)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/collect/kr.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/collect/kr.js
const BASE = 'https://polling.finance.naver.com/api/realtime/domestic'

async function fetchNaver(type, codes) {
  const res = await fetch(`${BASE}/${type}/${codes.join(',')}`)
  if (!res.ok) throw new Error(`naver ${type} 조회 실패: ${res.status}`)
  const json = await res.json()
  return json.datas
}

function toQuote(d) {
  const pct = parseFloat(d.fluctuationsRatio)
  return { code: d.itemCode, name: d.stockName, value: d.closePrice, pct: Math.abs(pct), isUp: pct >= 0 }
}

export function demoKr(watchlist) {
  return {
    kospi: { code: 'KOSPI', name: '코스피', value: '7,246.79', pct: 5.35, isUp: false },
    kosdaq: { code: 'KOSDAQ', name: '코스닥', value: '785.00', pct: 5.56, isUp: false },
    watchlist: watchlist.map((w, i) => ({ code: w.code, name: w.name, value: '277,500', pct: 6.25, isUp: i % 2 === 0 })),
  }
}

export async function collectKr(watchlist, { demo = false } = {}) {
  if (demo) return demoKr(watchlist)
  const [indexData, stockData] = await Promise.all([
    fetchNaver('index', ['KOSPI', 'KOSDAQ']),
    fetchNaver('stock', watchlist.map((w) => w.code)),
  ])
  const kospi = toQuote(indexData.find((d) => d.itemCode === 'KOSPI'))
  const kosdaq = toQuote(indexData.find((d) => d.itemCode === 'KOSDAQ'))
  return { kospi, kosdaq, watchlist: stockData.map(toQuote) }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/collect/kr.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/collect/kr.js src/collect/kr.test.js
git commit -m "feat: 한국 시황 수집(collect/kr) 추가"
```

---

### Task 5: `src/collect/news.js`

**Files:**
- Create: `src/collect/news.js`
- Test: `src/collect/news.test.js`

**Interfaces:**
- Consumes: `rss-parser`의 `Parser#parseURL(url)`.
- Produces: `collectNews({demo, limit}) => Promise<{title, link, pubDate}[]>`. Task 6, Task 11에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/collect/news.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectNews } from './news.js'

test('demo 모드는 limit개의 헤드라인을 반환', async () => {
  const result = await collectNews({ demo: true, limit: 3 })
  assert.equal(result.length, 3)
  assert.equal(typeof result[0].title, 'string')
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/collect/news.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/collect/news.js
import Parser from 'rss-parser'

const FEED_URL = 'https://www.mk.co.kr/rss/50200011/'

export function demoNews(limit = 5) {
  return Array.from({ length: limit }, (_, i) => ({
    title: `데모 뉴스 헤드라인 ${i + 1}`,
    link: 'https://example.com',
    pubDate: new Date(0).toISOString(),
  }))
}

export async function collectNews({ demo = false, limit = 5 } = {}) {
  if (demo) return demoNews(limit)
  const parser = new Parser()
  const feed = await parser.parseURL(FEED_URL)
  return feed.items.slice(0, limit).map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
  }))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/collect/news.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/collect/news.js src/collect/news.test.js
git commit -m "feat: 뉴스 헤드라인 수집(collect/news) 추가"
```

---

### Task 6: `src/collect/index.js` — 부분 실패 허용 조합

**Files:**
- Create: `src/collect/index.js`
- Test: `src/collect/index.test.js`

**Interfaces:**
- Consumes: `collectKr`(Task 4), `collectUs`(Task 3), `collectNews`(Task 5) — 기본값이지만 `opts.collectors`로 교체 가능(테스트용 의존성 주입).
- Produces: `collectDaily(config, opts) => Promise<{date: Date, kr, us, headlines, warnings: string[]}>`. `kr`/`us`는 실패 시 `null` + `warnings`에 사유 추가. 둘 다 실패하면 throw. Task 11에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (가짜 collector를 주입해 네트워크 없이 실패 경로까지 결정적으로 검증)**

```js
// src/collect/index.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectDaily } from './index.js'
import { config } from '../config.js'

test('demo 모드는 kr/us/headlines를 모두 채우고 warnings는 비어있음', async () => {
  const result = await collectDaily(config, { demo: true })
  assert.ok(result.kr)
  assert.ok(result.us)
  assert.equal(result.headlines.length > 0, true)
  assert.deepEqual(result.warnings, [])
})

test('kr/us 둘 다 실패하면 throw하고 사유가 warnings에 담긴다', async () => {
  const failingCollectors = {
    collectKr: async () => { throw new Error('kr down') },
    collectUs: async () => { throw new Error('us down') },
    collectNews: async () => [],
  }
  await assert.rejects(
    () => collectDaily(config, { collectors: failingCollectors }),
    /국내\/미국 데이터 모두 수집 실패/,
  )
})

test('kr만 실패하면 us/headlines로 계속 진행하고 warnings에 사유가 남는다', async () => {
  const partialCollectors = {
    collectKr: async () => { throw new Error('kr down') },
    collectUs: async (opts) => (await import('./us.js')).demoUs(),
    collectNews: async (opts) => (await import('./news.js')).demoNews(3),
  }
  const result = await collectDaily(config, { collectors: partialCollectors })
  assert.equal(result.kr, null)
  assert.ok(result.us)
  assert.equal(result.warnings.length, 1)
  assert.match(result.warnings[0], /한국 시황 수집 실패/)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/collect/index.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/collect/index.js
import { collectKr } from './kr.js'
import { collectUs } from './us.js'
import { collectNews } from './news.js'

function pick(result, warnings, message) {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${message}: ${result.reason.message}`)
  return null
}

export async function collectDaily(config, opts = {}) {
  const collectors = {
    collectKr,
    collectUs,
    collectNews,
    ...opts.collectors,
  }
  const warnings = []
  const [krResult, usResult, newsResult] = await Promise.allSettled([
    collectors.collectKr(config.KR_WATCHLIST, opts),
    collectors.collectUs(opts),
    collectors.collectNews(opts),
  ])

  const kr = pick(krResult, warnings, '한국 시황 수집 실패')
  const us = pick(usResult, warnings, '미국 시황 수집 실패')
  const headlines = pick(newsResult, warnings, '뉴스 헤드라인 수집 실패') ?? []

  if (!kr && !us) throw new Error('collect: 국내/미국 데이터 모두 수집 실패')

  return { date: new Date(), kr, us, headlines, warnings }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/collect/index.test.js`
Expected: PASS (3 tests), 네트워크 없이 결정적으로 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/collect/index.js src/collect/index.test.js
git commit -m "feat: collect 조합 + 부분 실패 처리 추가"
```

---

### Task 7: `src/summarize.js`

**Files:**
- Create: `src/summarize.js`
- Test: `src/summarize.test.js`

**Interfaces:**
- Consumes: `@anthropic-ai/sdk`의 `Anthropic#messages.create()` (tool-use 강제 호출로 구조화 출력).
- Produces: `summarize(dailyData, {client}) => Promise<{coverSubtitle, summaryLead, summaryRest, picks: {code, note}[], closingLine1, closingLine2, tomorrowPoint}>`. `client`를 주입하면 실제 API 호출 없이 테스트 가능. Task 11에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (가짜 client, 네트워크 없음)**

```js
// src/summarize.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from './summarize.js'

test('client가 반환한 tool_use.input을 그대로 반환', async () => {
  const fakeInput = {
    coverSubtitle: '테스트 요약',
    summaryLead: '반도체 강세',
    summaryRest: '코스피를 끌어올렸어요.',
    picks: [
      { code: '005930', note: '외국인 매수' },
      { code: '000660', note: '신고가' },
      { code: '247540', note: '차익 실현' },
    ],
    closingLine1: '반도체가 끌고,',
    closingLine2: '코스피는 회복!',
    tomorrowPoint: 'PCE 발표 예정',
  }
  const fakeClient = {
    messages: {
      create: async () => ({
        content: [{ type: 'tool_use', name: 'emit_card_copy', input: fakeInput }],
      }),
    },
  }
  const result = await summarize({ date: new Date(), kr: null, us: null, headlines: [] }, { client: fakeClient })
  assert.deepEqual(result, fakeInput)
})

test('tool_use 블록이 없으면 에러', async () => {
  const fakeClient = { messages: { create: async () => ({ content: [{ type: 'text', text: 'oops' }] }) } }
  await assert.rejects(
    () => summarize({ date: new Date(), kr: null, us: null, headlines: [] }, { client: fakeClient }),
    /구조화 출력/,
  )
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/summarize.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/summarize.js
import Anthropic from '@anthropic-ai/sdk'

const TOOL_NAME = 'emit_card_copy'

const CARD_COPY_TOOL = {
  name: TOOL_NAME,
  description: '카드뉴스에 들어갈 한국어 카피를 생성한다',
  input_schema: {
    type: 'object',
    properties: {
      coverSubtitle: { type: 'string', description: '커버 슬라이드 한 줄 소개' },
      summaryLead: { type: 'string', description: '시황 요약 강조 문구 (굵게 표시됨)' },
      summaryRest: { type: 'string', description: '시황 요약 나머지 문장' },
      picks: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '왓치리스트 종목 코드 중 하나' },
            note: { type: 'string', description: '해당 종목에 대한 한 줄 코멘트' },
          },
          required: ['code', 'note'],
        },
      },
      closingLine1: { type: 'string' },
      closingLine2: { type: 'string' },
      tomorrowPoint: { type: 'string' },
    },
    required: ['coverSubtitle', 'summaryLead', 'summaryRest', 'picks', 'closingLine1', 'closingLine2', 'tomorrowPoint'],
  },
}

const SYSTEM_PROMPT = `너는 인스타그램 주식뉴스 계정 '@마켓노트'의 카피라이터야.
간결하고 신뢰감 있는 한국어 톤으로 쓰고, 과장하거나 투자를 권유하지 마.
이 카드는 정보 요약이지 투자 조언이 아니야.`

export async function summarize(dailyData, { client } = {}) {
  const anthropic = client ?? new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [CARD_COPY_TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: JSON.stringify(dailyData) }],
  })
  const toolUse = message.content.find((b) => b.type === 'tool_use')
  if (!toolUse) throw new Error('summarize: 모델이 구조화 출력을 반환하지 않음')
  return toolUse.input
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/summarize.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/summarize.js src/summarize.test.js
git commit -m "feat: summarize.js — Anthropic 구조화 출력 추가"
```

---

### Task 8: `templates/neon.html` — 데이터 슬롯 + 방향(up/down) 클래스 추가

**Files:**
- Modify: `templates/neon.html`
- Test: `templates/neon.test.js`

**Interfaces:**
- Produces: `data-slot="..."` 속성이 달린 DOM 요소들, `data-pick="0|1|2"` 래퍼, `.up-text`/`.down-text`/`.pick-up`/`.pick-down`/`.badge-up`/`.badge-down` CSS 클래스. Task 9(render.js)가 이 슬롯 이름들을 그대로 사용.
- 필요한 전체 슬롯 목록: `date`, `coverSubtitle`, `kospi.value`, `kospi.pct`, `kospi.changeAbs`, `kosdaq.value`, `kosdaq.pct`, `nasdaq.value`, `nasdaq.pct`, `summary.lead`, `summary.rest`, `picks.0.name`/`picks.0.pct`/`picks.0.note` (1,2도 동일), `closingHeadline.line1`, `closingHeadline.line2`, `tomorrowPoint`.

- [ ] **Step 1: 실패하는 테스트 작성 (슬롯 존재 여부만 정적 검사, 브라우저 불필요)**

```js
// templates/neon.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const html = readFileSync(fileURLToPath(new URL('./neon.html', import.meta.url)), 'utf8')

const REQUIRED_SLOTS = [
  'date', 'coverSubtitle',
  'kospi.value', 'kospi.pct', 'kospi.changeAbs',
  'kosdaq.value', 'kosdaq.pct',
  'nasdaq.value', 'nasdaq.pct',
  'summary.lead', 'summary.rest',
  'picks.0.name', 'picks.0.pct', 'picks.0.note',
  'picks.1.name', 'picks.1.pct', 'picks.1.note',
  'picks.2.name', 'picks.2.pct', 'picks.2.note',
  'closingHeadline.line1', 'closingHeadline.line2',
  'tomorrowPoint',
]

test('neon.html에 필요한 data-slot이 모두 존재', () => {
  for (const slot of REQUIRED_SLOTS) {
    assert.ok(html.includes(`data-slot="${slot}"`), `missing slot: ${slot}`)
  }
})

test('neon.html에 pick 래퍼(data-pick)와 방향 클래스가 존재', () => {
  for (const i of [0, 1, 2]) assert.ok(html.includes(`data-pick="${i}"`))
  for (const cls of ['up-text', 'down-text', 'pick-up', 'pick-down', 'badge-up', 'badge-down']) {
    assert.ok(html.includes(cls), `missing class: ${cls}`)
  }
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test templates/neon.test.js`
Expected: FAIL — 슬롯들이 아직 없음

- [ ] **Step 3: `templates/neon.html` 편집 — CSS 클래스 추가**

Edit (style 블록 끝, `</style>` 직전):

```
old:
* { margin:0; padding:0; }
</style>

new:
* { margin:0; padding:0; }
.up-text{color:#34e89e !important}
.down-text{color:#ff6b8a !important}
.pick-up{border-color:rgba(52,232,158,.28) !important}
.pick-down{border-color:rgba(255,90,90,.28) !important}
.badge-up{background:rgba(52,232,158,.18) !important;color:#34e89e !important;box-shadow:0 0 18px rgba(52,232,158,.25);}
.badge-down{background:rgba(255,90,90,.16) !important;color:#ff6b8a !important;box-shadow:none;}
</style>
```

- [ ] **Step 4: 커버 슬라이드 — 날짜/부제 슬롯**

```
old:
      <div style="display:inline-block;margin-top:28px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:11px 24px;font-family:'Space Mono',monospace;font-size:20px;color:#e9e4ff;">2026.06.26 · 금요일</div>
      <div style="font-size:24px;color:#d8d2ee;margin-top:26px;line-height:1.5;">복잡한 증시, 오늘 핵심만<br>쏙쏙 골라 담았어요.</div>

new:
      <div data-slot="date" style="display:inline-block;margin-top:28px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:11px 24px;font-family:'Space Mono',monospace;font-size:20px;color:#e9e4ff;">2026.06.26 · 금요일</div>
      <div data-slot="coverSubtitle" style="font-size:24px;color:#d8d2ee;margin-top:26px;line-height:1.5;">복잡한 증시, 오늘 핵심만 쏙쏙 골라 담았어요.</div>
```

- [ ] **Step 5: 지수 슬라이드 — 코스피 값/등락**

```
old:
        <div>
          <div style="font-size:20px;color:#bdb4d8;">코스피 KOSPI</div>
          <div style="font-size:52px;font-weight:900;color:#ffffff;margin-top:4px;letter-spacing:-1.5px;">2,768.45</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:800;color:#34e89e;">▲ 0.82%</div>
          <div style="font-size:18px;color:#7fe9bf;margin-top:2px;">+22.6</div>
        </div>

new:
        <div>
          <div style="font-size:20px;color:#bdb4d8;">코스피 KOSPI</div>
          <div data-slot="kospi.value" style="font-size:52px;font-weight:900;color:#ffffff;margin-top:4px;letter-spacing:-1.5px;">2,768.45</div>
        </div>
        <div style="text-align:right;">
          <div data-slot="kospi.pct" class="up-text" style="font-size:32px;font-weight:800;">▲ 0.82%</div>
          <div data-slot="kospi.changeAbs" style="font-size:18px;color:#7fe9bf;margin-top:2px;">+22.6</div>
        </div>
```

- [ ] **Step 6: 지수 슬라이드 — 코스닥/나스닥 박스 (원/달러 → 나스닥으로 대체)**

```
old:
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,90,90,.3);border-radius:22px;padding:22px;">
        <div style="font-size:17px;color:#bdb4d8;">코스닥</div>
        <div style="font-size:30px;font-weight:800;color:#fff;margin-top:6px;">854.20</div>
        <div style="font-size:18px;color:#ff6b8a;font-weight:700;margin-top:4px;">▼ 0.34%</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(34,211,238,.3);border-radius:22px;padding:22px;">
        <div style="font-size:17px;color:#bdb4d8;">원/달러</div>
        <div style="font-size:30px;font-weight:800;color:#fff;margin-top:6px;">1,372.5</div>
        <div style="font-size:18px;color:#22d3ee;font-weight:700;margin-top:4px;">▲ 4.2원</div>
      </div>

new:
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);border-radius:22px;padding:22px;">
        <div style="font-size:17px;color:#bdb4d8;">코스닥</div>
        <div data-slot="kosdaq.value" style="font-size:30px;font-weight:800;color:#fff;margin-top:6px;">854.20</div>
        <div data-slot="kosdaq.pct" class="down-text" style="font-size:18px;font-weight:700;margin-top:4px;">▼ 0.34%</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);border-radius:22px;padding:22px;">
        <div style="font-size:17px;color:#bdb4d8;">나스닥 NASDAQ</div>
        <div data-slot="nasdaq.value" style="font-size:30px;font-weight:800;color:#fff;margin-top:6px;">17,890.55</div>
        <div data-slot="nasdaq.pct" class="up-text" style="font-size:18px;font-weight:700;margin-top:4px;">▲ 0.34%</div>
      </div>
```

- [ ] **Step 7: 지수 슬라이드 — 한줄 요약 lead/rest**

```
old:
    <div style="margin-top:auto;background:rgba(167,139,250,.12);border-radius:22px;padding:24px;font-size:21px;color:#e3def5;line-height:1.55;">한마디로, <b style="color:#c4b5fd;">반도체가 오늘의 주인공!</b> 코스피를 위로 끌어올렸어요.</div>

new:
    <div style="margin-top:auto;background:rgba(167,139,250,.12);border-radius:22px;padding:24px;font-size:21px;color:#e3def5;line-height:1.55;">한마디로, <b data-slot="summary.lead" style="color:#c4b5fd;">반도체가 오늘의 주인공!</b> <span data-slot="summary.rest">코스피를 위로 끌어올렸어요.</span></div>
```

- [ ] **Step 8: 종목픽 슬라이드 — 3개 카드에 슬롯/래퍼 부여 + 안내문구 수정**

```
old:
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(52,232,158,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:27px;font-weight:800;color:#fff;">삼성전자</span>
          <span style="background:rgba(52,232,158,.18);color:#34e89e;font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;box-shadow:0 0 18px rgba(52,232,158,.25);">+2.1%</span>
        </div>
        <div style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">HBM 증설 기대감에 외국인 매수가 들어왔어요.</div>
      </div>

new:
      <div data-pick="0" class="pick-up" style="background:rgba(255,255,255,.05);border:1px solid rgba(52,232,158,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span data-slot="picks.0.name" style="font-size:27px;font-weight:800;color:#fff;">삼성전자</span>
          <span data-slot="picks.0.pct" class="badge-up" style="font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;">+2.1%</span>
        </div>
        <div data-slot="picks.0.note" style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">HBM 증설 기대감에 외국인 매수가 들어왔어요.</div>
      </div>
```

```
old:
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(52,232,158,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:27px;font-weight:800;color:#fff;">SK하이닉스</span>
          <span style="background:rgba(52,232,158,.18);color:#34e89e;font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;box-shadow:0 0 18px rgba(52,232,158,.25);">+3.4%</span>
        </div>
        <div style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">엔비디아 납품 소식에 신고가까지 찍었어요!</div>
      </div>

new:
      <div data-pick="1" class="pick-up" style="background:rgba(255,255,255,.05);border:1px solid rgba(52,232,158,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span data-slot="picks.1.name" style="font-size:27px;font-weight:800;color:#fff;">SK하이닉스</span>
          <span data-slot="picks.1.pct" class="badge-up" style="font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;">+3.4%</span>
        </div>
        <div data-slot="picks.1.note" style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">엔비디아 납품 소식에 신고가까지 찍었어요!</div>
      </div>
```

```
old:
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,90,90,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:27px;font-weight:800;color:#fff;">에코프로비엠</span>
          <span style="background:rgba(255,90,90,.16);color:#ff6b8a;font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;">-1.8%</span>
        </div>
        <div style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">2차전지는 차익 실현 매물에 잠시 쉬어가요.</div>
      </div>
    </div>
    <div style="margin-top:auto;font-size:16px;color:#6b6388;">* 예시 데이터예요 · 실제 시세와 다를 수 있어요</div>

new:
      <div data-pick="2" class="pick-down" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,90,90,.28);border-radius:26px;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span data-slot="picks.2.name" style="font-size:27px;font-weight:800;color:#fff;">에코프로비엠</span>
          <span data-slot="picks.2.pct" class="badge-down" style="font-weight:800;font-size:22px;border-radius:999px;padding:7px 20px;">-1.8%</span>
        </div>
        <div data-slot="picks.2.note" style="font-size:19px;color:#c3bcdb;margin-top:12px;line-height:1.5;">2차전지는 차익 실현 매물에 잠시 쉬어가요.</div>
      </div>
    </div>
    <div style="margin-top:auto;font-size:16px;color:#6b6388;">* 투자 참고용 정보이며, 투자 권유가 아니에요</div>
```

- [ ] **Step 9: 마무리 슬라이드 — 헤드라인/내일 관전포인트 슬롯**

```
old:
    <div style="position:relative;font-size:42px;font-weight:900;color:#fff;margin-top:22px;line-height:1.25;letter-spacing:-1px;">반도체가 끌고,<br><span style="background:linear-gradient(100deg,#c4b5fd,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;">코스피는 2,768 회복!</span></div>
    <div style="position:relative;margin-top:24px;background:rgba(255,255,255,.06);border-radius:24px;padding:24px;">
      <div style="font-size:17px;color:#22d3ee;font-weight:800;">내일 관전 포인트</div>
      <div style="font-size:22px;color:#eee9ff;margin-top:9px;line-height:1.5;">밤 9:30, 미국 PCE 물가지수 발표가 변수예요.</div>
    </div>

new:
    <div style="position:relative;font-size:42px;font-weight:900;color:#fff;margin-top:22px;line-height:1.25;letter-spacing:-1px;"><span data-slot="closingHeadline.line1">반도체가 끌고,</span><br><span data-slot="closingHeadline.line2" style="background:linear-gradient(100deg,#c4b5fd,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;">코스피는 2,768 회복!</span></div>
    <div style="position:relative;margin-top:24px;background:rgba(255,255,255,.06);border-radius:24px;padding:24px;">
      <div style="font-size:17px;color:#22d3ee;font-weight:800;">내일 관전 포인트</div>
      <div data-slot="tomorrowPoint" style="font-size:22px;color:#eee9ff;margin-top:9px;line-height:1.5;">밤 9:30, 미국 PCE 물가지수 발표가 변수예요.</div>
    </div>
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `node --test templates/neon.test.js`
Expected: PASS (2 tests)

- [ ] **Step 11: 커밋**

```bash
git add templates/neon.html templates/neon.test.js
git commit -m "feat: neon.html에 데이터 슬롯/방향 클래스 추가"
```

---

### Task 9: `src/render/render.js`

**Files:**
- Create: `src/render/render.js`
- Test: `src/render/render.test.js`

**Interfaces:**
- Consumes: `playwright`의 `chromium.launch()`, Task 8에서 준비한 `templates/neon.html`의 슬롯들.
- Produces: `renderCards(cardCopy, {style, outDir}) => Promise<string[]>` — PNG 4장의 절대경로 배열, 순서는 `[cover, indices, stocks, closing]`. Task 11(pipeline)에서 사용.
- `cardCopy` shape (Task 11의 `assembleCardCopy`가 만드는 것과 동일):

```
{
  date: string, coverSubtitle: string,
  kospi: {value, pct, isUp}, kosdaq: {value, pct, isUp}, nasdaq: {value, pct, isUp},
  summaryLead: string, summaryRest: string,
  picks: [{name, pct, isUp, note}, {..}, {..}],   // 정확히 3개
  closingLine1: string, closingLine2: string, tomorrowPoint: string
}
```

- [ ] **Step 1: 실패하는 테스트 작성 (실제 Playwright로 스모크 렌더)**

```js
// src/render/render.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { renderCards } from './render.js'

const SAMPLE_CARD_COPY = {
  date: '2026.07.08 · 수요일',
  coverSubtitle: '오늘도 핵심만 쏙쏙 담았어요.',
  kospi: { value: '7,246.79', pct: 5.35, isUp: false },
  kosdaq: { value: '785.00', pct: 5.56, isUp: false },
  nasdaq: { value: '17,890.55', pct: 0.34, isUp: true },
  summaryLead: '변동성 장세!',
  summaryRest: '미국발 훈풍이 국내 증시를 흔들었어요.',
  picks: [
    { name: '삼성전자', pct: 6.25, isUp: false, note: '대형주 차익 실현 매물' },
    { name: 'SK하이닉스', pct: 3.1, isUp: true, note: '반도체 수요 기대감' },
    { name: '에코프로비엠', pct: 2.0, isUp: false, note: '2차전지 조정' },
  ],
  closingLine1: '변동성 컸던 하루,',
  closingLine2: '코스피 5%대 급락 마감',
  tomorrowPoint: '미국 PCE 물가지수 발표를 주목하세요.',
}

test('renderCards는 PNG 4장을 생성한다', async () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'card-news-'))
  const paths = await renderCards(SAMPLE_CARD_COPY, { style: 'neon', outDir })
  assert.equal(paths.length, 4)
  for (const p of paths) {
    const stat = statSync(p)
    assert.ok(stat.size > 1000, `${p} is too small: ${stat.size} bytes`)
  }
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/render/render.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/render/render.js
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NATIVE_CARD = { width: 640, height: 800 }
const TARGET_CARD = { width: 1080, height: 1350 }
const SCALE = TARGET_CARD.width / NATIVE_CARD.width // 1.6875 — 640×800 카드를 1080×1350으로 캡처

const SLIDES = [
  { label: 'B1 Cover', file: '01-cover.png' },
  { label: 'B2 Indices', file: '02-indices.png' },
  { label: 'B3 Stocks', file: '03-stocks.png' },
  { label: 'B4 Closing', file: '04-closing.png' },
]

function applyCardCopy(cardCopy) {
  const setText = (slot, value) => {
    const el = document.querySelector(`[data-slot="${slot}"]`)
    if (el) el.textContent = value
  }
  const setDirection = (el, isUp) => {
    el.classList.toggle('up-text', isUp)
    el.classList.toggle('down-text', !isUp)
  }
  const setPct = (slot, isUp, pct) => {
    const el = document.querySelector(`[data-slot="${slot}"]`)
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

  setText('nasdaq.value', cardCopy.nasdaq.value)
  setPct('nasdaq.pct', cardCopy.nasdaq.isUp, cardCopy.nasdaq.pct)

  setText('summary.lead', cardCopy.summaryLead)
  setText('summary.rest', cardCopy.summaryRest)

  cardCopy.picks.forEach((pick, i) => {
    setText(`picks.${i}.name`, pick.name)
    const badge = document.querySelector(`[data-slot="picks.${i}.pct"]`)
    badge.textContent = `${pick.isUp ? '+' : '-'}${pick.pct}%`
    badge.classList.toggle('badge-up', pick.isUp)
    badge.classList.toggle('badge-down', !pick.isUp)
    const card = document.querySelector(`[data-pick="${i}"]`)
    card.classList.toggle('pick-up', pick.isUp)
    card.classList.toggle('pick-down', !pick.isUp)
    setText(`picks.${i}.note`, pick.note)
  })

  setText('closingHeadline.line1', cardCopy.closingLine1)
  setText('closingHeadline.line2', cardCopy.closingLine2)
  setText('tomorrowPoint', cardCopy.tomorrowPoint)
}

export async function renderCards(cardCopy, { style = 'neon', outDir } = {}) {
  const templatePath = path.join(__dirname, '..', '..', 'templates', `${style}.html`)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 2800, height: 900 } })
    await page.goto(`file://${templatePath}`)
    await page.evaluate(applyCardCopy, cardCopy)
    await page.evaluate(() => document.fonts.ready)

    const paths = []
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/render/render.test.js`
Expected: PASS (몇 초 소요 — chromium 기동 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/render/render.js src/render/render.test.js
git commit -m "feat: render.js — Playwright 카드 4장 렌더 추가"
```

---

### Task 10: `src/notify.js`

**Files:**
- Create: `src/notify.js`
- Test: `src/notify.test.js`

**Interfaces:**
- Consumes: `nodemailer`의 `createTransport().sendMail()`.
- Produces: `buildMailOptions(cardCopy, pngPaths, {warnings, to}) => mailOptions` (순수 함수, 테스트용), `sendCardNewsMail(cardCopy, pngPaths, opts) => Promise<mailOptions>` — `opts.demo`면 실제 발송 없이 `mailOptions`만 반환. Task 11에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (네트워크 없이 buildMailOptions만 검증)**

```js
// src/notify.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMailOptions } from './notify.js'

const SAMPLE_CARD_COPY = {
  date: '2026.07.08 · 수요일',
  coverSubtitle: '오늘도 핵심만 담았어요.',
  summaryLead: '반도체 강세', summaryRest: '코스피를 끌어올렸어요.',
  picks: [
    { name: '삼성전자', pct: 2.1, isUp: true, note: 'HBM 기대감' },
    { name: 'SK하이닉스', pct: 3.4, isUp: true, note: '신고가' },
    { name: '에코프로비엠', pct: 1.8, isUp: false, note: '차익 실현' },
  ],
  closingLine1: '반도체가 끌고,', closingLine2: '코스피는 회복!',
  tomorrowPoint: 'PCE 발표 예정',
}

test('buildMailOptions는 수신자/제목/첨부 4장을 포함한다', () => {
  const options = buildMailOptions(SAMPLE_CARD_COPY, ['/tmp/1.png', '/tmp/2.png', '/tmp/3.png', '/tmp/4.png'], {
    to: 'hec8897@naver.com',
  })
  assert.equal(options.to, 'hec8897@naver.com')
  assert.match(options.subject, /2026\.07\.08/)
  assert.equal(options.attachments.length, 4)
  assert.match(options.text, /삼성전자/)
})

test('warnings가 있으면 본문 상단에 경고가 포함된다', () => {
  const options = buildMailOptions(SAMPLE_CARD_COPY, [], { warnings: ['미국 시황 수집 실패: timeout'] })
  assert.match(options.text, /미국 시황 수집 실패/)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/notify.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// src/notify.js
import nodemailer from 'nodemailer'

export function buildMailOptions(cardCopy, pngPaths, { warnings = [], to } = {}) {
  const warningBlock = warnings.length ? `⚠️ ${warnings.join(' / ')}\n\n` : ''
  const picksText = cardCopy.picks
    .map((p) => `- ${p.name} (${p.isUp ? '▲' : '▼'}${p.pct}%): ${p.note}`)
    .join('\n')
  const text =
    `${warningBlock}${cardCopy.date}\n\n${cardCopy.coverSubtitle}\n\n` +
    `[시황]\n${cardCopy.summaryLead} ${cardCopy.summaryRest}\n\n` +
    `[종목픽]\n${picksText}\n\n` +
    `[마무리]\n${cardCopy.closingLine1} ${cardCopy.closingLine2}\n내일 관전 포인트: ${cardCopy.tomorrowPoint}`

  return {
    from: process.env.NAVER_EMAIL,
    to: to || process.env.MAIL_TO || process.env.NAVER_EMAIL,
    subject: `[마켓노트] ${cardCopy.date} 카드뉴스`,
    text,
    attachments: pngPaths.map((filePath, i) => ({ filename: `card-${i + 1}.png`, path: filePath })),
  }
}

export async function sendCardNewsMail(cardCopy, pngPaths, opts = {}) {
  const mailOptions = buildMailOptions(cardCopy, pngPaths, opts)
  if (opts.demo) return mailOptions
  const transporter = nodemailer.createTransport({
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    auth: { user: process.env.NAVER_EMAIL, pass: process.env.NAVER_APP_PASSWORD },
  })
  await transporter.sendMail(mailOptions)
  return mailOptions
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/notify.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/notify.js src/notify.test.js
git commit -m "feat: notify.js — 네이버 메일 발송 추가"
```

---

### Task 11: `src/pipeline.js`

**Files:**
- Create: `src/pipeline.js`
- Test: `src/pipeline.test.js`

**Interfaces:**
- Consumes: `collectDaily`(Task 6), `summarize`(Task 7), `renderCards`(Task 9), `sendCardNewsMail`(Task 10).
- Produces: `runPipeline(config, opts) => Promise<{cardCopy, pngPaths, mailOptions, warnings}>`. Task 12(bin/publish.js)에서 사용.
- `opts`: `{demo: boolean, style?: string, client?: AnthropicClient}` — `client`는 테스트에서 `summarize`에 그대로 전달됨.

- [ ] **Step 1: 실패하는 테스트 작성 (전체 파이프라인, demo + 가짜 Anthropic client)**

```js
// src/pipeline.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { runPipeline } from './pipeline.js'
import { config } from './config.js'

const fakeClient = {
  messages: {
    create: async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'emit_card_copy',
          input: {
            coverSubtitle: '테스트 커버',
            summaryLead: '변동성 장세',
            summaryRest: '증시가 크게 흔들렸어요.',
            picks: config.KR_WATCHLIST.slice(0, 3).map((w) => ({ code: w.code, note: `${w.name} 코멘트` })),
            closingLine1: '오늘 정리,',
            closingLine2: '변동성 컸던 하루',
            tomorrowPoint: 'PCE 발표 주목',
          },
        },
      ],
    }),
  },
}

test('runPipeline은 demo 모드로 끝까지 실행되고 메일은 발송하지 않는다', async () => {
  const result = await runPipeline(config, { demo: true, client: fakeClient })
  assert.equal(result.pngPaths.length, 4)
  assert.equal(result.cardCopy.picks.length, 3)
  assert.equal(result.mailOptions.attachments.length, 4)
  rmSync('out', { recursive: true, force: true })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/pipeline.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/pipeline.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pipeline.js src/pipeline.test.js
git commit -m "feat: pipeline.js — collect→summarize→render→notify 오케스트레이션"
```

---

### Task 12: `bin/publish.js` — CLI 진입점

**Files:**
- Create: `bin/publish.js`

**Interfaces:**
- Consumes: `runPipeline`(Task 11), `config`(Task 2).
- Produces: `node bin/publish.js [--style neon] [--demo]` 커맨드.

- [ ] **Step 1: 구현 (스크립트라 별도 유닛 테스트 없음 — Task 13에서 `--demo` 실행으로 검증)**

```js
#!/usr/bin/env node
// bin/publish.js
import { runPipeline } from '../src/pipeline.js'
import { config } from '../src/config.js'

process.loadEnvFile?.('.env')

function argFlag(args, name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const args = process.argv.slice(2)
const style = argFlag(args, '--style')
const demo = args.includes('--demo')

const result = await runPipeline(config, { style, demo })

console.log(`완료: PNG ${result.pngPaths.length}장 생성, 메일 ${demo ? '(demo, 미발송)' : '발송 완료'}`)
if (result.warnings.length) console.warn('경고:', result.warnings.join(' / '))
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x bin/publish.js`

- [ ] **Step 3: 커밋**

```bash
git add bin/publish.js
git commit -m "feat: bin/publish.js CLI 진입점 추가"
```

---

### Task 13: README 업데이트 + 전체 데모 실행 검증

**Files:**
- Modify: `README.md`

**Interfaces:**
- 없음 (문서 + 수동 검증 태스크).

- [ ] **Step 1: README에 실행법/환경변수 섹션 갱신**

`README.md`의 "사용"/"환경변수" 섹션을, 이번에 추가된 `notify` 단계와 `.env.example` 사용법을 반영해 업데이트한다 (Naver 앱 비밀번호 발급 경로 안내 포함: 네이버 메일 → 환경설정 → POP3/IMAP/SMTP 설정 → 사용 설정 후 앱 비밀번호 발급).

- [ ] **Step 2: 전체 데모 실행으로 파이프라인 검증**

Run: `cp .env.example .env && node bin/publish.js --demo`
Expected: `완료: PNG 4장 생성, 메일 (demo, 미발송)` 출력, `out/<오늘날짜>/01-cover.png` ~ `04-closing.png` 생성 확인.

`--demo`는 네트워크 수집을 건너뛰지 않는다는 점 주의 — `collectDaily`는 `opts.demo`를 그대로 `collectKr`/`collectUs`/`collectNews`에 전달하므로 데모 모드에서는 수집도 고정 샘플로 대체된다. 요약(summarize)만은 실제 `ANTHROPIC_API_KEY`가 있으면 실제 API를 호출한다 — 완전 오프라인 검증이 필요하면 `client` 옵션을 코드에서 직접 주입해야 하며, CLI에는 이 옵션이 없다(의도적 — 카피 품질까지 보고 싶을 때가 대부분이므로).

- [ ] **Step 3: 실제 발송 1회 확인 (선택, 자격증명 준비된 경우)**

`.env`에 `ANTHROPIC_API_KEY`, `NAVER_EMAIL`, `NAVER_APP_PASSWORD`를 채운 뒤:

Run: `node bin/publish.js`
Expected: `hec8897@naver.com`으로 카드뉴스 메일 수신.

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: 메일 발송 파이프라인 사용법 업데이트"
```

---

## 이후 (이번 계획 범위 밖)

- Claude Code 예약 작업(cron)으로 `npm run publish`를 매일 아침 등록 — 코드 변경이 아니라 실행 환경 설정이라 이 플랜 완료 후 별도로 진행.
- 인스타그램 자동 업로드/승인 플로우 — 기존 설계의 Phase 2, 별도 브레인스토밍 필요.
