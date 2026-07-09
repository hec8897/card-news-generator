# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

주식뉴스 인스타그램 카드 자동 발행기. 매일 `node bin/publish.js` 한 번으로 데이터 수집 → AI 요약 → PNG 캐러셀 렌더 → (Phase 1) 메일 발송까지 도는 파이프라인. 상세 설계는 `docs/superpowers/specs/`.

## Commands

```bash
npm install                      # deps + playwright chromium 필요 (npx playwright install chromium)
npm run publish                  # 전체 파이프라인: 수집 → 요약 → 렌더 → 메일 발송
node bin/publish.js --demo       # 수집/발송을 고정 샘플·미발송으로 대체 (요약은 실제 OpenAI 호출)
node bin/publish.js --style neon # 카드 시안 선택 (현재 neon만 지원)
```

- 테스트 프레임워크 없음. 검증은 `--demo`로 라이브 스모크 실행 (OpenAI만 실제 호출, KR/US/뉴스/메일은 가짜).
- `--demo`에도 `OPENAI_API_KEY`는 필수. 요약을 가짜로 대체하는 옵션은 의도적으로 없음.
- `.env`는 `bin/publish.js`가 `process.loadEnvFile('.env')`로 로드. 필수 키: `OPENAI_API_KEY`, `NAVER_EMAIL`, `NAVER_APP_PASSWORD`(로그인 비번 아닌 앱 비번).

ES modules (`"type": "module"`), Node >=20.6. 빌드/린트 단계 없음 — 소스가 곧 실행 대상.

## Architecture

`runPipeline` (src/pipeline.js) 가 4단계를 순차 실행. 데이터가 `DailyData → CardCopy → PNG[]` 형태로 흐름:

```
collect ──DailyData──▶ summarize ──summary──▶ assembleCardCopy ──CardCopy──▶ render ──PNG[]──▶ notify
```

**collect** (src/collect/index.js) — `Promise.allSettled`로 KR/US/뉴스를 병렬 수집하며 부분 실패를 허용(실패는 `warnings`에 누적). KR은 네이버 금융 폴링 JSON, US는 yahoo-finance2, 뉴스는 매경 RSS. **KR/US 둘 다 실패할 때만** throw. 단, 하류 `assembleCardCopy`가 `kr` 없이는 throw하므로 사실상 KR이 필수, US는 없으면 nasdaq을 `-`로 폴백. 각 collect 모듈은 `demo*` export를 가지며 `opts.demo`일 때 이를 반환.

**summarize** (src/summarize.js) — OpenAI `gpt-5.5`, `json_schema` strict 구조화 출력으로 `DailyData`를 카드 문구(`CardCopy` 부분)로 변환. `--demo`와 무관하게 항상 실제 API 호출. `client` 옵션으로 OpenAI 인스턴스 주입 가능(테스트용).

**assembleCardCopy** (src/pipeline.js) — summary와 collect 데이터를 병합해 최종 `CardCopy` 생성. 핵심: 모델이 고른 `summary.picks[].code`를 `kr.watchlist`의 실제 종목(등락률 등)에 코드로 조인 — 모델은 어떤 종목인지 고르기만 하고 수치는 실데이터에서 가져옴.

**render** (src/render/render.js) — Playwright headless chromium이 `templates/neon.html`을 `file://`로 열고, `applyCardCopy`를 `page.evaluate`로 브라우저 컨텍스트에서 실행해 `[data-slot]` 요소에 텍스트/등락 클래스를 주입한 뒤 `[data-label]` 4개 요소를 개별 스크린샷. `applyCardCopy`는 브라우저 안에서 도는 순수 DOM 코드 — Node API 사용 불가. `deviceScaleFactor = 1.6875`로 640×800 네이티브 카드를 1080×1350(4:5)로 캡처. `neon` 외 스타일은 명시적 throw.

**notify** (src/notify.js) — 네이버 SMTP(`smtp.naver.com:465`) Nodemailer로 PNG 4장 첨부 + 카드 문구 본문 메일 발송. `opts.demo`면 발송 없이 `mailOptions`만 반환.

**config** (src/config.js) — `KR_WATCHLIST`(종목 코드+이름 하드코딩)와 기본 `STYLE`. 왓치리스트 변경은 여기서.

카드 시안을 추가하려면: `templates/<name>.html`에 `[data-slot]`/`[data-label]` 마크업을 맞춰 만들고, render.js의 `style !== 'neon'` 가드를 확장. Phase 2(인스타그램 Graph API 자동 발행)는 미구현 — README의 `IG_*` 환경변수는 자리표시자.
