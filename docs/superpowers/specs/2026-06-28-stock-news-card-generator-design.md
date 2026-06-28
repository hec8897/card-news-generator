# 주식뉴스 카드 자동 발행기 — 설계

작성일: 2026-06-28

## 목표

Claude Design의 "Instagram 주식뉴스 카드" 디자인을 코드로 가져와, 매일 명령어 한 번으로
**데이터 수집 → AI 요약 → PNG 캐러셀 렌더 → 인스타그램 발행**까지 도는 파이프라인을 만든다.

- 계정 콘셉트: `@마켓노트` (주식 시황/종목 뉴스 카드)
- 캐러셀 구성: 커버 → 시황요약 → 종목픽 → 마무리 (4장, 1080×1350, 4:5)
- 시장: 한국(코스피/코스닥) + 미국(S&P500/나스닥)
- 실행: 반자동 — `npm run publish` 한 번이 전체 파이프라인 실행
- 디자인 시안: B(NEON NIGHT) 기본값으로 추천, 시안 교체 가능하게 구조화

## 결정 사항

| 항목 | 결정 |
|---|---|
| 런타임 | Node.js (단일 언어). 디자인이 HTML/CSS라 Playwright로 그대로 렌더 |
| AI 요약 | Anthropic SDK (`@anthropic-ai/sdk`), 모델 `claude-opus-4-8`, 어댑티브 thinking |
| 렌더 | Playwright(chromium) headless, viewport 1080×1350, 카드별 screenshot |
| 발행 | Instagram Graph API (캐러셀). **Phase 2** — 자격증명 준비 후 연결 |
| 데이터(US) | `yahoo-finance2` npm (무키), 지수 + 등락 종목 |
| 데이터(KR) | 네이버 금융 JSON 엔드포인트(무키), 코스피/코스닥 지수 + 상위 종목 |
| 뉴스 헤드라인 | RSS 피드(야후/네이버 금융), 무키 |
| 시안 교체 | `STYLE` 설정값(`terminal`/`neon`/`editorial`)으로 템플릿 선택 |

## 단계 구성 (Phasing)

### Phase 1 — 발행 직전까지 (인스타 제외)
데이터 수집 → AI 요약 → PNG 4장 생성까지 완성. 인스타엔 수동 업로드.
이 단계만으로 매일 검증/사용 가능.

### Phase 2 — 인스타 자동 발행
Meta/IG 비즈니스 계정 + 토큰 준비되면 발행 모듈 연결. 완전 자동.

> ⚠️ 인스타 자동 포스팅은 **Instagram Graph API**가 필요하며 다음이 선행되어야 함(사용자가 직접 준비):
> 1. IG 비즈니스/크리에이터 계정 + 연결된 페이스북 페이지
> 2. Meta 개발자 앱 + 장기 액세스 토큰
> 3. 이미지가 **공개 URL**에 호스팅되어야 함 (Graph API는 URL 업로드만 지원 → 임시 호스팅 필요)

## 아키텍처

단일 CLI 파이프라인. 각 단계는 독립 모듈로, 입력/출력이 명확한 순수 함수에 가깝게.

```
src/
  config.js        # 환경변수/시안/종목 설정 로드
  collect/
    us.js          # yahoo-finance2 → MarketData
    kr.js          # 네이버 금융 JSON → MarketData
    news.js        # RSS → Headline[]
    index.js       # 위 셋을 합쳐 DailyData 반환
  summarize.js     # DailyData → CardCopy (Anthropic, 구조화 출력)
  render/
    templates/     # terminal.html, neon.html, editorial.html (Claude Design에서 추출)
    render.js      # CardCopy + template → PNG[] (Playwright)
  publish.js       # PNG[] → Instagram 캐러셀 (Phase 2)
  pipeline.js      # collect → summarize → render → (publish) 오케스트레이션
bin/publish.js     # npm run publish 진입점
out/               # 생성된 PNG (날짜 폴더)
```

### 데이터 흐름

```
collect/index.js ──DailyData──▶ summarize.js ──CardCopy──▶ render.js ──PNG[]──▶ publish.js
```

### 핵심 타입 (JSDoc/구조)

```
MarketData = { market: 'KR'|'US', indices: [{name, value, changePct}], movers: [{ticker, name, changePct}] }
Headline   = { title, source, url }
DailyData  = { date, markets: MarketData[], headlines: Headline[] }
CardCopy   = {
  cover:   { title, subtitle },
  market:  { headline, bullets: string[] },   // 시황요약
  picks:   { items: [{ticker, name, note}] }, // 종목픽
  closing: { message }                         // 마무리
}
```

## 각 모듈 설계

### 1. collect — 데이터 수집
- `us.js`: `yahoo-finance2`의 `quote()`로 `^GSPC`, `^IXIC`, `^DJI` 지수. 등락 종목은
  trending/gainers 엔드포인트. 실패 시 해당 시장 빈 배열 + 경고 로그(파이프라인 중단 안 함).
- `kr.js`: 네이버 금융 polling JSON(예: `polling.finance.naver.com`)으로 코스피/코스닥 지수.
  상위 종목은 네이버 금융 거래상위 페이지 파싱. 무키.
- `news.js`: 금융 RSS 피드 파싱(`rss-parser`), 최신 N개 헤드라인.
- 경계: 네트워크 실패는 부분 실패로 처리 — 가능한 데이터로 진행, 무엇이 빠졌는지 로그.

### 2. summarize — AI 요약
- Anthropic SDK, `claude-opus-4-8`, `thinking: {type:'adaptive'}`.
- **구조화 출력**(`output_config.format` json_schema)으로 `CardCopy` 스키마 강제 → 파싱 불필요.
- 시스템 프롬프트: `@마켓노트` 톤(간결·신뢰감), 한국어, 과장/투자권유 금지.
- 입력: `DailyData`를 JSON으로. 출력: `CardCopy`.
- 안전장치: 투자 조언이 아닌 정보 요약임을 프롬프트에 명시.

### 3. render — PNG 렌더
- Playwright chromium headless, `viewport {width:1080, height:1350}`, `deviceScaleFactor:2`.
- 템플릿 HTML에 `CardCopy` 데이터를 주입(플레이스홀더 치환 또는 `page.evaluate`).
- 카드 4장 각각 `page.screenshot()` → `out/<date>/01-cover.png` ... `04-closing.png`.
- 시안: `config.STYLE`로 `templates/<style>.html` 선택.
- 템플릿은 Claude Design의 `.dc.html`에서 추출해 데이터 슬롯만 변수화.

### 4. publish — 인스타 발행 (Phase 2)
- 이미지 4장을 공개 URL에 업로드(임시 호스팅 — Supabase Storage 등, 추후 결정).
- IG Graph API: 각 이미지 `media` 컨테이너 생성 → 캐러셀 컨테이너 → publish.
- 토큰/계정ID는 환경변수. Phase 1에서는 스텁(미설정 시 "PNG만 생성" 안내 후 종료).

### 5. pipeline / bin
- `pipeline.js`: 순차 실행, 각 단계 진입/완료 로그, 단계 실패 시 명확한 메시지.
- `bin/publish.js`: `node bin/publish.js [--style neon] [--no-publish]`.

## 설정 (환경변수)
```
ANTHROPIC_API_KEY     # 필수 (요약)
STYLE=neon            # 기본 시안
IG_ACCESS_TOKEN       # Phase 2
IG_USER_ID            # Phase 2
PUBLIC_IMAGE_BASE_URL # Phase 2 (이미지 호스팅)
```
종목 픽 후보/관심 종목 리스트는 `config.js`에 상수로(추후 조정).

## 테스트 전략 (ponytail: 최소 실행 가능 검증)
- `collect`: 각 소스 어댑터에 `--demo`로 고정 샘플 반환 옵션 → 네트워크 없이 파이프라인 검증.
- `summarize`: CardCopy 스키마 검증 assert (필수 필드 존재).
- `render`: 샘플 CardCopy로 PNG 4장 생성되는지 스모크 체크.
- 프레임워크 없이 `node --test` 또는 간단한 `assert` 기반 self-check.

## 범위에서 제외 (YAGNI)
- 웹 대시보드/관리 UI — 불필요(반자동 CLI로 충분)
- DB 영속화 — 매일 1회 실행, 결과는 파일로 충분
- 다중 계정/스케줄러 — 지금은 수동 트리거. 추후 cron으로 감쌀 수 있게 CLI만 유지
- 디자인 시안 3종 동시 — 1종(neon) 먼저, 교체 가능 구조만 확보
