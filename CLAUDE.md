# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **커밋/푸시는 사용자가 명시적으로 요청할 때만.** 요청 없이 `git commit`·`git push` 하지 말 것. 변경은 파일 수정까지만 하고, 커밋 여부는 사용자가 결정.

주식뉴스 인스타그램 카드 자동 발행기. 매일 `node bin/publish.ts` 한 번으로 데이터 수집 → AI 요약 → PNG 캐러셀(5장) 렌더 → (Phase 1) 메일 발송까지 도는 파이프라인. 상세 설계는 `docs/superpowers/specs/`.

## Commands

```bash
npm install                      # deps + playwright chromium 필요 (npx playwright install chromium)
npm run publish                  # 전체 파이프라인: 수집 → 요약 → 렌더 → 메일 발송
npm run typecheck                # tsc --noEmit (빌드 없이 타입 체크만)
node bin/publish.ts --demo       # 수집/발송을 고정 샘플·미발송으로 대체 (요약은 실제 OpenAI 호출)
node bin/publish.ts --style neon # 카드 시안 선택 (현재 neon만 지원)

node bin/brief.ts [--eval]       # 테마 시황 JSON (--eval이면 AI 총평·핵심뉴스까지). 토스 필요
node bin/themes.ts [--top 3]     # 테마별 시총 상위 종목. 토스 필요
node bin/news.ts [--limit 10] [--query 반도체주]  # 뉴스 후보만. 토스 불필요 → IP 미등록 환경에서도 됨
```

- 테스트 프레임워크 없음. 검증은 `--demo`로 라이브 스모크 실행 (OpenAI만 실제 호출, KR/뉴스/메일은 가짜) + `npm run typecheck`.
- `--demo`에도 `OPENAI_API_KEY`는 필수. 요약을 가짜로 대체하는 옵션은 의도적으로 없음.
- `.env`는 `bin/publish.ts`가 `process.loadEnvFile('.env')`로 로드. 필수 키: `OPENAI_API_KEY`, `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `NAVER_EMAIL`, `NAVER_APP_PASSWORD`(로그인 비번 아닌 앱 비번).

TypeScript(ESM, `"type": "module"`), Node >=23.6. **빌드 단계 없음** — Node 네이티브 타입 스트리핑으로 `.ts`를 직접 실행. 상대 import는 `.ts` 확장자를 명시(`./news.ts`).

## Architecture

**저장소에 파이프라인이 두 벌 있다.** 구 경로는 현재 유일하게 발행이 되는 쪽이고, 신 경로는 `design/`의 새 테마 카드용 데이터 레이어로 아직 렌더에 연결되지 않았다. 파일명·타입 파일이 둘을 구분한다:

```
구  bin/publish.ts → pipeline.ts → collect/legacy-kr.ts ┐
                                   collect/news.ts      ┴─DailyData─▶ ai/summarize.ts
                                   ─CardCopy─▶ render/render.ts ─PNG[]─▶ notify.ts
    타입: types/card.ts

신  bin/brief.ts   → collect/market.ts → toss.ts + collect/themes.ts + collect/news.ts
                                   ─MarketBrief─▶ ai/evaluate.ts ─MarketEval─▶ (렌더 미연결)
    타입: types/market.ts
```

`types/shared.ts`는 양쪽이 같이 쓰는 것만(`Quote`/`Headline`/`*Opts`/`Config`). 새 템플릿이 완성되면 구 경로(`legacy-kr.ts`, `ai/summarize.ts`, `types/card.ts`, `templates/neon.html`)를 통째로 지우는 게 목표.

**toss** (src/toss.ts) — 토스증권 Open API(OAuth2 client_credentials) 공용 클라이언트. `fetchToss`는 429를 백오프 재시도하고, `fetchDailyChange`는 일봉 2개로 장마감 종가·등락률을 계산한다(`/prices`는 시간외가 섞여 장마감 기준이 안 됨). 지수·종목이 이 함수를 공유. **IP 화이트리스트 필요** — 등록 안 된 IP(카페 WiFi, GitHub Actions 등)에서는 토큰 발급이 403 `IP address not allowed`. 그래서 자동 실행은 로컬(고정 IP 등록됨)에서 launchd로 돈다. 미국 지수는 토스가 미지원이라 범위에서 제외.

**collect/legacy-kr** (구) — 코스피/코스닥 지수 + `rankings?type=MARKET_TRADING_AMOUNT` 거래대금 상위 3종목. `collectDaily`가 `Promise.allSettled`로 시황/뉴스를 병렬 수집하며 부분 실패를 허용(실패는 `warnings`에 누적, 시황이 없으면 throw). `demoKr` export로 `--demo` 대응.

**collect/market** (신) — 코스피 지수 + 투자자별 순매수 + 테마별 시총가중 수익률/상위 3종목 + 뉴스 후보를 단일 `MarketBrief` JSON으로.

**collect/themes** — 테마별 구성종목은 수기 큐레이션(`THEMES`). 종목 시세는 순차 조회 — 병렬로 쏘면 토스 429.

**collect/news** — 네이버 뉴스 검색 API. 쿼리는 `NEWS_QUERIES`(테마명 대신 증권가 업종어 — `전력`이 아니라 `전력기기주`, 중의어 회피). `sort=sim`(관련도), 쿼리별 라운드로빈으로 병합해 기사 많은 테마가 전부 차지하는 걸 막는다. 한 쿼리가 실패해도 나머지는 살린다.

**ai/summarize** (구) — OpenAI `gpt-5.5`, `json_schema` strict 구조화 출력으로 `DailyData`를 카드 문구(`Summary`)로 변환. `--demo`와 무관하게 항상 실제 API 호출. `client` 옵션으로 OpenAI 인스턴스 주입 가능(테스트용).

**ai/evaluate** (신) — `MarketBrief`를 시장 총평 + 핵심 뉴스 선별로. 뉴스는 인덱스 매핑으로 실제 링크를 보존(AI가 URL을 지어내지 않게).

**assembleCardCopy** (src/pipeline.ts) — summary와 collect 데이터를 병합해 최종 `CardCopy` 생성. 핵심: 모델이 고른 `summary.picks[].code`를 `kr.watchlist`의 실제 종목(등락률 등)에 코드로 조인 — 모델은 어떤 종목인지 고르기만 하고 수치는 실데이터에서 가져옴.

**render** (src/render/render.ts) — Playwright headless chromium이 `templates/neon.html`을 `file://`로 열고, `applyCardCopy`를 `page.evaluate`로 브라우저 컨텍스트에서 실행해 `[data-slot]` 요소에 텍스트/등락 클래스를 주입한 뒤 `[data-label]` 5개 요소를 개별 스크린샷. `applyCardCopy`는 브라우저 안에서 도는 순수 DOM 코드 — Node API 사용 불가(타입은 Node가 실행 전 제거). `deviceScaleFactor = 1.6875`로 640×800 네이티브 카드를 1080×1350(4:5)로 캡처. `neon` 외 스타일은 명시적 throw. PNG는 `out/<YYYY-MM-DD>/`에 저장.

**notify** (src/notify.ts) — 네이버 SMTP(`smtp.naver.com:465`) Nodemailer로 PNG 5장 첨부 + 카드 문구 본문 메일 발송. `opts.demo`면 발송 없이 `mailOptions`만 반환.

**config** (src/config.ts) — 기본 `STYLE`만. (종목픽은 토스 거래대금 상위로 매일 자동 산출 — 하드코딩 왓치리스트 없음.)

## 자동 실행 (로컬 launchd)

`~/Library/LaunchAgents/com.cardnewsgenerator.publish.plist` — 매일 10:00 1차, 실패 시 30분 간격 12:00까지 재시도(`bin/publish-with-retry.sh`가 당일 성공 마커 `logs/.done/<날짜>`로 중복 방지). GitHub Actions 워크플로우는 남아있지만 토스 IP 문제로 스케줄은 끄고 `workflow_dispatch`(수동)만 유지.

## EC2 접속

```bash
ssh cardnews-ec2                        # 접속 정보는 ~/.ssh/config의 Host cardnews-ec2 참고 (로컬 전용, 커밋 안 됨)
cat ~/card-news-generator/logs/cron.log # EC2 쪽 실행 로그
bin/deploy.sh                           # 로컬에서 EC2로 배포 (git pull + npm install), bin/deploy.sh 자체는 미커밋
bin/run-remote.sh                       # EC2에서 크론 기다리지 않고 즉시 수동 발행, 미커밋 (실제 메일 발송됨)
```

카드 시안을 추가하려면: `templates/<name>.html`에 `[data-slot]`/`[data-label]` 마크업을 맞춰 만들고, render.ts의 `style !== 'neon'` 가드를 확장. Phase 2(인스타그램 Graph API 자동 발행)는 미구현 — README의 `IG_*` 환경변수는 자리표시자.
