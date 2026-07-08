import { collectKr } from './kr.js'
import { collectUs } from './us.js'
import { collectNews } from './news.js'

function pick(result, warnings, message) {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${message}: ${result.reason.message}`)
  return null
}

export async function collectDaily(config, opts = {}) {
  const warnings = []
  const [krResult, usResult, newsResult] = await Promise.allSettled([
    collectKr(config.KR_WATCHLIST, opts),
    collectUs(opts),
    collectNews(opts),
  ])

  const kr = pick(krResult, warnings, '한국 시황 수집 실패')
  const us = pick(usResult, warnings, '미국 시황 수집 실패')
  const headlines = pick(newsResult, warnings, '뉴스 헤드라인 수집 실패') ?? []

  if (!kr && !us) throw new Error('collect: 국내/미국 데이터 모두 수집 실패')

  return { date: new Date(), kr, us, headlines, warnings }
}
