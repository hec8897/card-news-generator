import { collectKr } from './kr.js'
import { collectNews } from './news.js'

function pick(result, warnings, message) {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${message}: ${result.reason.message}`)
  return null
}

export async function collectDaily(opts = {}) {
  const warnings = []
  const [krResult, newsResult] = await Promise.allSettled([
    collectKr(opts),
    collectNews(opts),
  ])

  const kr = pick(krResult, warnings, '한국 시황 수집 실패')
  const headlines = pick(newsResult, warnings, '뉴스 헤드라인 수집 실패') ?? []

  if (!kr) throw new Error(`collect: 국내 시황 데이터 수집 실패 — ${warnings.join(' / ')}`)

  return { date: new Date(), kr, headlines, warnings }
}
