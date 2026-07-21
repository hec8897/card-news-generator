# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

주식뉴스 인스타그램 카드 자동 발행기. 매일 `node bin/publish.ts` 한 번으로 데이터 수집 → AI 요약 → PNG 캐러셀(5장) 렌더 → (Phase 1) 메일 발송까지 도는 파이프라인. 상세 설계는 `docs/superpowers/specs/`.

## Commands

```bash
npm install                      # deps + playwright chromium 필요 (npx playwright install chromium)
npm run publish                  # 전체 파이프라인: 수집 → 요약 → 렌더 → 메일 발송
npm run typecheck                # tsc --noEmit (빌드 없이 타입 체크만)
node bin/publish.ts --demo       # 수집/발송을 고정 샘플·미발송으로 대체 (요약은 실제 OpenAI 호출)
node bin/publish.ts --style neon # 카드 시안 선택 (현재 neon만 지원)
```

- 테스트 프레임워크 없음. 검증은 `--demo`로 라이브 스모크 실행 (OpenAI만 실제 호출, KR/뉴스/메일은 가짜) + `npm run typecheck`.
- `--demo`에도 `OPENAI_API_KEY`는 필수. 요약을 가짜로 대체하는 옵션은 의도적으로 없음.
- `.env`는 `bin/publish.ts`가 `process.loadEnvFile('.env')`로 로드. 필수 키: `OPENAI_API_KEY`, `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `NAVER_EMAIL`, `NAVER_APP_PASSWORD`(로그인 비번 아닌 앱 비번).

TypeScript(ESM, `"type": "module"`), Node >=23.6. **빌드 단계 없음** — Node 네이티브 타입 스트리핑으로 `.ts`를 직접 실행. 상대 import는 `.ts` 확장자를 명시(`./kr.ts`). 타입 정의는 `src/types.ts`에 집중.

## Architecture

`runPipeline` (src/pipeline.ts) 가 4단계를 순차 실행. 데이터가 `DailyData → CardCopy → PNG[]` 형태로 흐름:

```
collect ──DailyData──▶ summarize ──Summary──▶ assembleCardCopy ──CardCopy──▶ render ──PNG[]──▶ notify
```

**collect** (src/collect/index.ts) — `Promise.allSettled`로 KR 시황/뉴스를 병렬 수집하며 부분 실패를 허용(실패는 `warnings`에 누적). KR이 없으면 throw(뉴스는 없어도 진행). 각 collect 모듈은 `demo*` export를 가지며 `opts.demo`일 때 이를 반환.

**collect/kr** (src/collect/kr.ts) — 토스증권 Open API(OAuth2 client_credentials). 코스피/코스닥은 `market-indicators/{symbol}/candles`로 전일 대비 등락 계산, 종목픽은 `rankings?type=MARKET_TRADING_AMOUNT`(실시간 거래대금 상위 3)를 뽑아 `stocks`로 종목명 조인. **토스 API는 IP 화이트리스트 필요** — 등록 안 된 IP(GitHub Actions 등)에서는 토큰 발급이 401/403. 그래서 자동 실행은 로컬(고정 IP 등록됨)에서 launchd로 돈다. 미국 지수는 토스가 미지원이라 범위에서 제외.

**collect/news** (src/collect/news.ts) — 매일경제 증권 RSS(`mk.co.kr/rss/50200011`)를 rss-parser로 파싱, 상위 5건.

**summarize** (src/summarize.ts) — OpenAI `gpt-5.5`, `json_schema` strict 구조화 출력으로 `DailyData`를 카드 문구(`Summary`)로 변환. `--demo`와 무관하게 항상 실제 API 호출. `client` 옵션으로 OpenAI 인스턴스 주입 가능(테스트용).

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
