# Handoff: 코스피 테마별 시황 Instagram 카드

## Overview
인스타그램 피드용 코스피(코스피만, 코스닥/환율 제외) 테마별 시황 카드뉴스. 4:5 세로 캐러셀, 5장 구성. "블룸버그 터미널" 무드 — 다크 배경, 모노스페이스 데이터, 그리드 라인.

## About the Design Files
이 번들의 HTML 파일은 **디자인 레퍼런스**입니다 — 의도한 룩앤필과 콘텐츠 구조를 보여주는 프로토타입이며, 그대로 복사해 붙일 프로덕션 코드가 아닙니다. 값은 전부 하드코딩된 예시입니다.

이 저장소에서의 구현 방식은 정해져 있습니다: **Playwright가 `templates/<style>.html`을 열고 `[data-slot]`에 값을 주입한 뒤 `[data-label]` 요소를 개별 스크린샷**합니다(`src/render/render.ts`). 프레임워크를 새로 고를 필요 없이 기존 `templates/neon.html`과 같은 방식으로 `templates/theme.html`을 만들면 됩니다.

카드별 슬롯이 어떤 데이터에서 오는지는 아래 **데이터 매핑** 절 참고.

## Fidelity
**High-fidelity.** 색상, 타이포그래피, 간격, 레이아웃이 최종안입니다. 코드베이스의 기존 컴포넌트/라이브러리로 픽셀 단위까지 재현해 주세요.

## Format
- 카드 크기: 640×800px 편집 기준 (배포 시 1080×1350px로 스케일 — 인스타그램 세로 피드 4:5 비율)
- 카드 5장, 좌→우 순서로 캐러셀 재생

## Screens / Views

### 1. Cover (표지)
- **Purpose**: 오늘 콘텐츠가 "코스피 테마별 시황"임을 알림
- **Layout**: `padding:44px`, flex column. 상단에 KOSPI 지수 티커 바(하단 보더), 중앙에 큰 타이틀 블록(margin-top/bottom:auto로 수직 중앙), 하단에 계정명 + swipe 안내 + 페이지 도트
- **Background**: `#0a0d12` 바탕 + 격자 패턴(`linear-gradient` 1px 라인, 28px 간격, 흰색 3.5% 불투명도) + `1px solid rgba(255,176,0,.22)` 보더
- **Components**:
  - 티커 바: `font-family: 'Space Mono', monospace`, 13px, color `#5f6878`; 강조 값은 `#2bd576`(상승)
  - 라벨 "// SECTOR SCAN": Space Mono 14px bold, `#ffb000`, letter-spacing 2px
  - 타이틀: Pretendard 62px weight 800, `#f1f3f7`, line-height 1.05. 마지막 글자 뒤 깜빡이는 커서(`_`, `#ffb000`, `blink` 1.1s step-end infinite keyframe: opacity 1→0 at 50%)
  - 날짜: Space Mono 19px, `#9aa2b1`
  - 서브카피: Pretendard 18px, `#c4cad6`, line-height 1.5
  - 계정명 "@money.updown": Space Mono 15px, `#7b8190`
  - "SWIPE →": 14px, `#ffb000`
  - 페이지 도트: 5개, 활성 24×5px `#ffb000` pill / 비활성 7×5px `#3a4150` pill, gap 7px

### 2. KOSPI Overview (코스피 전체 지표)
- **Purpose**: 코스피 지수·수급을 한눈에
- **Layout**: 상단 섹션 라벨 → 지수 카드(스파크라인 포함) → 3열 지표 그리드 → 하단 하이라이트 박스 → 도트
- **Background**: `#0a0d12`, 보더 `1px solid rgba(255,255,255,.08)`
- **Components**:
  - 섹션 라벨: "01 — KOSPI" Space Mono 14px bold `#ffb000` + " / OVERVIEW" `#5f6878`
  - 지수 카드: `#11151d` 배경, `1px solid rgba(43,213,118,.3)` 보더, radius 16px, padding 28px. 좌측 라벨(17px `#9aa2b1`)+값(Space Mono 44px bold `#eef1f6`), 우측 등락률(Space Mono 26px bold `#2bd576`)+등락폭(15px `#7fe9bf`)
  - SVG 스파크라인: 400×100 viewBox, path fill `rgba(43,213,118,0.14)`, polyline stroke `#2bd576` width 3.5
  - 3열 지표 카드(개인/외국인/기관 순매수): 각 `#11151d` 배경, `1px solid rgba(255,255,255,.07)`, radius 14px, padding 18px; 라벨 Space Mono 12px `#5f6878`, 값 Space Mono 20px bold (양수 `#2bd576`, 음수 `#ff5a5a`)
  - 하이라이트 박스: `rgba(255,176,0,.08)` 배경, 좌측 보더 3px `#ffb000`, radius 6px, padding 16px 18px, 텍스트 16px `#d7dce5`

### 3. Theme Ranking (테마 랭킹)
- **Purpose**: 코스피 내 테마별 등락률 순위
- **정렬**: `returnPct` 내림차순 (상승 테마가 위)
- **Layout**: 섹션 라벨 → 랭킹 리스트(5행) → 각주 → 도트
- **Components**: 각 랭킹 행 — flex row, gap 14px, `#11151d` 배경, radius 12px, padding 16px 18px. 순번(Space Mono bold, 상위 3위는 `#ffb000`, 나머지 `#5f6878`, width 20px) / 테마명(18px bold `#eef1f6`, flex:1) / 등락률(Space Mono 18px bold, 양수 `#2bd576`, 보합 `#9aa2b1`, 음수 `#ff5a5a`). 보더 컬러는 등락 방향에 따라 `rgba(43,213,118,.25)`(상승) / `rgba(255,255,255,.08)`(보합) / `rgba(255,90,90,.25)`(하락)

### 4. Theme Deep Dive (오늘의 테마)
- **Purpose**: "오늘의 테마"를 종목 단위로 드릴다운
- **선정 기준**: `max(|returnPct|)` — 가장 많이 오르거나 **가장 많이 빠진** 섹터. 1위 테마가 아니다. 하락장에서는 랭킹 최하위가 선정되는 게 정상 동작
- **Layout**: 섹션 라벨 → 테마명+등락률 → 설명 문장 → 종목 리스트(3행) → 하이라이트 박스 → 도트
- **Components**: 보더 강조 `1px solid rgba(255,176,0,.2)`. 테마 타이틀 32px bold `#eef1f6` + 등락률. 종목 행은 Overview의 3열 카드와 동일한 톤(`#11151d`/`rgba(255,255,255,.07)` 보더, radius 12px)이지만 좌우 justify-between 레이아웃(종목명 17px bold / 등락률 Space Mono 17px bold)
- **음수 분기 필수**: 시안은 상승(`#2bd576`) 기준으로 그려져 있으나 선정 기준상 하락 테마가 자주 온다. 테마 등락률·종목 등락률 모두 음수면 `#ff5a5a`로 전환할 것

### 5. Sector News (오늘의 테마 뉴스)
- **Purpose**: 오늘의 테마가 왜 움직였는지 뉴스 3건으로 + 팔로우 유도
- **Layout**: 섹션 라벨 → 번호 매긴 뉴스 리스트(3행) → CTA 박스 → 디스클레이머 → 도트
- **Background**: Cover와 동일한 격자+보더 스타일(시작/끝 슬라이드 통일감)
- **Components**: 뉴스 행 — 번호(Space Mono bold `#ffb000`) + 제목(17px bold `#eef1f6`) + 그 아래 why 한 줄(14px `#9aa2b1`). CTA 박스: 배경 `#ffb000` 통짜, radius 16px, padding 20px, 텍스트는 다크(`#1a1205`) — 타이틀 18px bold, 서브(팔로우 안내) Space Mono 16px bold. 디스클레이머 12px `#5f6878`
- 뉴스는 **오늘의 테마(카드 4)에 한정**된 기사. 시장 전체 뉴스가 아니다. 링크는 카드에 표시하지 않는다(캡션용으로만 보관)

## 데이터 매핑

각 슬롯이 어디서 오는지. 소스는 `collect/market.ts`의 `MarketBrief`와 `ai/evaluate.ts`의 `MarketEval` 둘뿐 — 그 외 값은 전부 고정 문구다.

| 카드 | 슬롯 | 소스 |
|---|---|---|
| 1 | KOSPI 티커 | `kospi.value` / `kospi.pct` / `kospi.isUp` |
| 1 | 날짜 (`2026.07.22 WED`) | `date` + `Intl.DateTimeFormat('ko-KR',{weekday})` |
| 1 | 타이틀·서브카피·계정명 | 고정 |
| 2 | 지수 값·등락률 | `kospi.value` / `kospi.pct` |
| 2 | 등락폭 (`+22.6`) | **미구현 (#1)** — `toss.fetchDailyChange`가 `prev`를 이미 계산하니 `diff` 반환 추가 |
| 2 | 스파크라인 | **미구현 (#2)** — `candles?count=2` → `count=30`, 종가 배열을 polyline points로 |
| 2 | 개인/외국인/기관 | `investorTrading.{individual,foreigner,institution}.net` |
| 2 | 하이라이트 박스 | `marketEval` — 단 현재 3문장이라 2줄로 줄이는 프롬프트 조정 필요 |
| 3 | 테마 5행 | `themes[].theme` / `themes[].returnPct` (내림차순 정렬) |
| 4 | 테마명·등락률 | `max(|themes[].returnPct|)` |
| 4 | 설명 한 줄 | **미구현 (#4)** — `MarketEval`에 `themeComment` 추가 |
| 4 | 종목 3행 | 선정 테마의 `top3[].name` / `.pct` (시총 상위 3) |
| 4 | 하단 박스 | 고정 |
| 5 | 뉴스 3행 | `news[].title` + `news[].why` — **단 테마 특정 필요 (#6)** |
| 5 | CTA·디스클레이머 | 고정 |

### 남은 작업 4가지
1. **등락폭** — `fetchDailyChange` 반환에 `diff` 추가 (수집 레이어)
2. **스파크라인 시계열** — 캔들 조회 개수 확대 (수집 레이어)
4. **`themeComment`** — `evaluate` 스키마 확장 + 프롬프트
6. **테마 타깃 뉴스** — 수집 순서 변경. 현재 `collectMarketBrief`는 테마와 뉴스를 병렬로 쏘는데, 오늘의 테마는 시총 집계가 끝나야 정해진다. 라운드로빈 병합 특성상 테마당 후보가 1~2건뿐이라 그중 3건을 고를 수도 없다. 따라서 **테마 확정 → 해당 테마 쿼리(`news.ts`의 `THEME_QUERIES`)로 2차 타깃 검색 → `evaluate`가 3건 선별** 순으로 직렬화한다. 시장 전체 뉴스는 `marketEval` 근거로 계속 필요하므로 양쪽 다 수집한다

1·2는 `node bin/brief.ts`로, 4·6은 `node bin/brief.ts --eval`로 렌더 없이 검증된다.

### 렌더 레이어 (별도)
데이터가 다 차도 카드가 나오려면 아래가 남는다. `templates/neon.html`+`CardCopy`를 쓰는 구 경로와 완전히 다른 배선이다.
- `templates/theme.html` — 이 번들의 HTML을 `[data-slot]`/`[data-label]` 마크업으로 변환 (현재 파일은 값이 하드코딩된 시안)
- `render.ts` — `applyCardCopy`가 `CardCopy` 구조에 묶여 있어 `MarketBrief`+`MarketEval`을 받도록 재작성
- `pipeline.ts` — 구 경로 대신 신 경로를 태우도록 교체

## Interactions & Behavior
- 정적 카드뉴스 — 인터랙션 없음. 인스타그램 캐러셀 게시물로 좌→우 스와이프
- 페이지 도트는 실제 인스타그램 UI가 아니라 디자인에 그려 넣은 장식 요소(진행 표시용)

## Design Tokens

### Colors
- Background base: `#0a0d12` (표지/마무리는 `#05070a` wrapper 위에 카드가 얹힘)
- Card surface: `#11151d`
- Border default: `rgba(255,255,255,.07)` ~ `.08`
- Accent (brand/amber): `#ffb000`
- Positive/up: `#2bd576` (라이트 톤 `#7fe9bf`)
- Negative/down: `#ff5a5a`
- Neutral/flat: `#9aa2b1`
- Text primary: `#eef1f6` / `#f1f3f7`
- Text secondary: `#c4cad6` / `#d7dce5`
- Text tertiary/muted: `#9aa2b1`, `#7b8190`, `#5f6878`, `#3a4150`

### Typography
- Display/body font: Pretendard (한글), fallback sans-serif
- Data/mono font: 'Space Mono', monospace (숫자, 티커, 라벨, 도트 인디케이터 근처 타이포)
- Scale used: 12 / 13 / 14 / 15 / 16 / 17 / 18 / 19 / 20 / 26 / 32 / 44 / 62px
- Weights: 400(본문), 700(강조/숫자), 800(타이틀)

### Spacing / Radius
- Card padding: 44px
- Card radius: 22px
- Inner block radius: 12–16px
- Gaps: 12–24px 사이 (섹션 성격에 따라)

### Shadow
- Card shadow: `0 30px 80px rgba(0,0,0,.5)`

## Assets
아이콘/이미지 없음 — 전부 CSS/SVG로 구현(스파크라인은 인라인 SVG polyline). 폰트는 CDN: Pretendard(jsdelivr), Space Mono(Google Fonts).

## Files
- `코스피 테마별 시황 A.dc.html` — 5장 카드 전체 (원본은 프로젝트 루트의 `코스피 테마별 시황 A.dc.html`)
