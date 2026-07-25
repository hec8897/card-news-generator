import type { Headline, CollectOpts } from '../types/shared.ts'

// 네이버 뉴스 검색 오픈 API (서버-투-서버, 무료 25k/일). 키워드로 조준 검색 → 테마/시장 뉴스 후보.
const ENDPOINT = 'https://openapi.naver.com/v1/search/news.json'

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// 테마명을 그대로 검색하면 중의어에 걸린다(전력→범죄 전력, 뷰티→연예, 금융→공기업 후원).
// 증권가가 실제로 쓰는 업종어로 치환한 것 — 후보를 실측 비교해 골랐다. THEMES 키와 1:1.
// ponytail: 인터넷주는 잡음이 좀 섞인다. 소프트웨어 테마(NAVER/카카오)에 대응하는
// 깔끔한 업종 검색어가 없어서 차선. 더 좋은 후보를 찾으면 이 줄만 교체.
const THEME_QUERIES: Record<string, string> = {
  반도체: '반도체주',
  소프트웨어: '인터넷주',
  전력: '전력기기주',
  뷰티: '화장품주',
  금융: '금융',
  자동차: '자동차주',
  조선: '조선주',
  방산: '방산주',
  // ponytail: '바이오주'는 회사명에 "바이오"가 들어간 잡주를 대량으로 긁어와 쓸 수 없다.
  // '제약주'가 후보 중 가장 깨끗했지만 삼바·셀트리온 쪽 기사는 덜 잡힌다. 더 나은 후보를 찾으면 교체.
  바이오: '제약주',
}

export const NEWS_QUERIES = ['코스피', '증시', ...Object.values(THEME_QUERIES)]

/** 테마명 → 뉴스 검색어. 매핑이 없으면 테마명에 `주`를 붙여 최소한 증시 문맥은 준다. */
export function queryForTheme(theme: string): string {
  return THEME_QUERIES[theme] ?? `${theme}주`
}

async function searchNaver(query: string, display: number): Promise<Headline[]> {
  // sort=sim(관련도). sort=date는 발행 몇 분 이내 기사만 긁어와 정치·사건사고가 섞인다.
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID ?? '',
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET ?? '',
    },
  })
  if (!res.ok) throw new Error(`네이버 뉴스 검색 실패 (${query}): ${res.status}`)
  const json = await res.json()
  return (json.items ?? []).map(
    (it: any): Headline => ({
      title: clean(it.title),
      link: it.originallink || it.link,
      pubDate: it.pubDate,
      description: clean(it.description),
    }),
  )
}

export function demoNews(limit = 5): Headline[] {
  return Array.from({ length: limit }, (_, i) => ({
    title: `데모 뉴스 헤드라인 ${i + 1}`,
    link: 'https://example.com',
    pubDate: new Date(0).toISOString(),
    description: '데모 요약',
  }))
}

export async function collectNews({
  demo = false,
  limit = 5,
  queries = NEWS_QUERIES,
}: CollectOpts = {}): Promise<Headline[]> {
  if (demo) return demoNews(limit)

  const perQuery = Math.max(3, Math.ceil((limit * 2) / queries.length))
  // 쿼리 하나가 실패해도 나머지는 살린다 (뉴스는 없어도 파이프라인이 진행되는 부가 데이터)
  const settled = await Promise.allSettled(queries.map((q) => searchNaver(q, perQuery)))
  const results = settled.map((r) => (r.status === 'fulfilled' ? r.value : []))

  // 쿼리별 1건씩 라운드로빈 — 전체를 날짜순으로 줄세우면 기사량 많은 테마가 전부 차지한다
  const seen = new Set<string>()
  const merged: Headline[] = []
  for (let rank = 0; merged.length < limit && rank < perQuery; rank++) {
    for (const list of results) {
      const h = list[rank]
      if (!h) continue
      const key = h.link ?? h.title ?? ''
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(h)
      if (merged.length >= limit) break
    }
  }
  return merged
}
