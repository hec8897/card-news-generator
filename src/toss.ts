// 토스증권 Open API 공용 클라이언트 (OAuth2 client_credentials).
// collect/ 하위 수집 모듈들이 공유.
const BASE = 'https://openapi.tossinvest.com'

export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TOSS_CLIENT_ID ?? '',
      client_secret: process.env.TOSS_CLIENT_SECRET ?? '',
    }),
  })
  // 403은 대개 IP 화이트리스트 미등록 — 본문에 사유가 들어있어 그대로 노출
  if (!res.ok) throw new Error(`토스증권 토큰 발급 실패: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token
}

/**
 * 일봉으로 장마감 종가·등락률·등락폭을 계산. 지수·종목 공통.
 * /prices는 시간외까지 섞여 "장마감 기준"이 안 되므로 candles를 쓴다.
 * pct/diff는 부호 있음 — 절댓값+isUp이 필요한 쪽에서 변환할 것.
 * count를 늘려 호출하면 `closes`로 시계열(과거→최근)이 따라온다(스파크라인용).
 */
export async function fetchDailyChange(
  path: string,
  token: string,
): Promise<{ price: number; pct: number; diff: number; closes: number[] }> {
  const { result } = await fetchToss(path, token)
  const closes: number[] = result.candles.map((c: { closePrice: string }) => parseFloat(c.closePrice))
  const [price, prev] = closes
  const diff = price - prev
  return {
    price,
    pct: Number(((diff / prev) * 100).toFixed(2)),
    diff: Number(diff.toFixed(2)),
    closes: [...closes].reverse(), // 토스는 최신순으로 주므로 뒤집어 과거→최근
  }
}

export async function fetchToss(path: string, token: string, retries = 3): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1))) // rate-limit 백오프
      continue
    }
    if (!res.ok) throw new Error(`토스증권 조회 실패 (${path}): ${res.status}`)
    return res.json()
  }
}
