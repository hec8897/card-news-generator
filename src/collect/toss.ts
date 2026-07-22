// 토스증권 Open API 공용 클라이언트 (OAuth2 client_credentials).
// kr.ts(시황 수집)와 themes.ts(테마 시총) 등이 공유.
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
  if (!res.ok) throw new Error(`토스증권 토큰 발급 실패: ${res.status}`)
  const json = await res.json()
  return json.access_token
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
