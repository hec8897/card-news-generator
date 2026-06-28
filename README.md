# card-news-generator

주식뉴스 인스타그램 카드 자동 발행기. 매일 명령어 한 번으로
**데이터 수집 → AI 요약 → PNG 캐러셀 렌더 → 인스타그램 발행**까지 도는 파이프라인.

- 계정 콘셉트: `@마켓노트` (주식 시황/종목 뉴스 카드)
- 캐러셀: 커버 → 시황요약 → 종목픽 → 마무리 (4장, 1080×1350, 4:5)
- 시장: 한국(코스피/코스닥) + 미국(S&P500/나스닥)

> 상세 설계는 [docs/superpowers/specs/2026-06-28-stock-news-card-generator-design.md](docs/superpowers/specs/2026-06-28-stock-news-card-generator-design.md) 참고.

## 현재 상태

설계 단계. 구현 전.

## 파이프라인

```
collect ──DailyData──▶ summarize ──CardCopy──▶ render ──PNG[]──▶ publish
```

| 단계 | 역할 | 기술 |
|---|---|---|
| collect | 시황·종목·뉴스 수집 | yahoo-finance2(US), 네이버 금융 JSON(KR), RSS |
| summarize | DailyData → CardCopy | Anthropic SDK, `claude-opus-4-8`, 구조화 출력 |
| render | CardCopy → PNG 4장 | Playwright(chromium) headless |
| publish | PNG → IG 캐러셀 | Instagram Graph API (Phase 2) |

## 단계 구성

- **Phase 1** — 데이터 수집 → AI 요약 → PNG 4장 생성. 인스타는 수동 업로드.
- **Phase 2** — IG 비즈니스 계정 + 토큰 준비 후 자동 발행 연결.

## 사용

```bash
npm install
npm run publish              # 전체 파이프라인
node bin/publish.js --style neon --no-publish
```

## 환경변수

```
ANTHROPIC_API_KEY      # 필수 (요약)
STYLE=neon             # 기본 시안 (terminal | neon | editorial)
IG_ACCESS_TOKEN        # Phase 2
IG_USER_ID             # Phase 2
PUBLIC_IMAGE_BASE_URL  # Phase 2 (이미지 호스팅)
```
