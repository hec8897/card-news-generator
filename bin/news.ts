#!/usr/bin/env node
// 네이버 뉴스 후보만 조회 (토스 토큰 불필요 — 화이트리스트 안 된 네트워크에서도 됨).
// 사용: node bin/news.ts [--limit 10] [--query 코스피 --query 반도체]
import { collectNews, NEWS_QUERIES } from '../src/collect/news.ts'

try {
  process.loadEnvFile?.('.env')
} catch {
  // .env 없는 환경(환경변수 직접 주입) — 무시
}

const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const limit = Number(limitIdx === -1 ? 10 : args[limitIdx + 1])
const picked = args.flatMap((a, i) => (a === '--query' ? [args[i + 1]!] : []))
const queries = picked.length ? picked : NEWS_QUERIES

const news = await collectNews({ limit, queries })
console.log(`쿼리: ${queries.join(', ')} — ${news.length}건\n`)
news.forEach((n, i) => {
  console.log(`${String(i + 1).padStart(2)}. [${n.pubDate}] ${n.title}`)
  console.log(`    ${n.description}`)
  console.log(`    ${n.link}\n`)
})
