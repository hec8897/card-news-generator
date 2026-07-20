import { collectKr } from './kr.ts'
import { collectNews } from './news.ts'
import type { DailyData, CollectOpts } from '../types.ts'

function pick<T>(result: PromiseSettledResult<T>, warnings: string[], message: string): T | null {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${message}: ${(result.reason as Error).message}`)
  return null
}

export async function collectDaily(opts: CollectOpts = {}): Promise<DailyData> {
  const warnings: string[] = []
  const [krResult, newsResult] = await Promise.allSettled([collectKr(opts), collectNews(opts)])

  const kr = pick(krResult, warnings, '한국 시황 수집 실패')
  const headlines = pick(newsResult, warnings, '뉴스 헤드라인 수집 실패') ?? []

  if (!kr) throw new Error(`collect: 국내 시황 데이터 수집 실패 — ${warnings.join(' / ')}`)

  return { date: new Date(), kr, headlines, warnings }
}
