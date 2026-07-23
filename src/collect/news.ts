import type { Headline, CollectOpts } from '../types.ts'

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

async function searchNaver(query: string, display: number): Promise<Headline[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=${display}&sort=date`
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
  queries = ['코스피', '증시'],
}: CollectOpts = {}): Promise<Headline[]> {
  if (demo) return demoNews(limit)

  const perQuery = Math.max(5, Math.ceil((limit * 2) / queries.length))
  const results = await Promise.all(queries.map((q) => searchNaver(q, perQuery)))

  // link 기준 중복 제거 후 최신순 정렬
  const seen = new Set<string>()
  const merged: Headline[] = []
  for (const h of results.flat()) {
    const key = h.link ?? h.title ?? ''
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(h)
  }
  merged.sort((a, b) => new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime())
  return merged.slice(0, limit)
}
