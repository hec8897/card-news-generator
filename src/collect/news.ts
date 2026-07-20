import Parser from 'rss-parser'
import type { Headline, CollectOpts } from '../types.ts'

const FEED_URL = 'https://www.mk.co.kr/rss/50200011/'

export function demoNews(limit = 5): Headline[] {
  return Array.from({ length: limit }, (_, i) => ({
    title: `데모 뉴스 헤드라인 ${i + 1}`,
    link: 'https://example.com',
    pubDate: new Date(0).toISOString(),
  }))
}

export async function collectNews({ demo = false, limit = 5 }: CollectOpts = {}): Promise<Headline[]> {
  if (demo) return demoNews(limit)
  const parser = new Parser()
  const feed = await parser.parseURL(FEED_URL)
  return feed.items.slice(0, limit).map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
  }))
}
