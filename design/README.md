# Handoff: 코스피 테마별 시황 Instagram 카드

## Overview
인스타그램 피드용 코스피(코스피만, 코스닥/환율 제외) 테마별 시황 카드뉴스. 4:5 세로 캐러셀, 5장 구성. "블룸버그 터미널" 무드 — 다크 배경, 모노스페이스 데이터, 그리드 라인.

## About the Design Files
이 번들의 HTML 파일은 **디자인 레퍼런스**입니다 — 의도한 룩앤필과 콘텐츠 구조를 보여주는 프로토타입이며, 그대로 복사해 붙일 프로덕션 코드가 아닙니다. 실제 구현은 대상 코드베이스의 기존 환경(React 등 이미 쓰는 프레임워크/컴포넌트/디자인 토큰)을 사용해 이 디자인을 재현하는 것이 목표입니다. 코드베이스가 아직 없다면 콘텐츠 성격(정적 카드 이미지 생성/발행)에 맞는 프레임워크를 새로 선택해 구현하세요.

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
  - 계정명 "@마켓노트": Space Mono 15px, `#7b8190`
  - "SWIPE →": 14px, `#ffb000`
  - 페이지 도트: 5개, 활성 24×5px `#ffb000` pill / 비활성 7×5px `#3a4150` pill, gap 7px

### 2. KOSPI Overview (코스피 전체 지표)
- **Purpose**: 코스피 지수·거래대금·수급을 한눈에
- **Layout**: 상단 섹션 라벨 → 지수 카드(스파크라인 포함) → 3열 지표 그리드 → 하단 하이라이트 박스 → 도트
- **Background**: `#0a0d12`, 보더 `1px solid rgba(255,255,255,.08)`
- **Components**:
  - 섹션 라벨: "01 — KOSPI" Space Mono 14px bold `#ffb000` + " / OVERVIEW" `#5f6878`
  - 지수 카드: `#11151d` 배경, `1px solid rgba(43,213,118,.3)` 보더, radius 16px, padding 28px. 좌측 라벨(17px `#9aa2b1`)+값(Space Mono 44px bold `#eef1f6`), 우측 등락률(Space Mono 26px bold `#2bd576`)+등락폭(15px `#7fe9bf`)
  - SVG 스파크라인: 400×100 viewBox, path fill `rgba(43,213,118,0.14)`, polyline stroke `#2bd576` width 3.5
  - 3열 지표 카드(거래대금/외국인/기관): 각 `#11151d` 배경, `1px solid rgba(255,255,255,.07)`, radius 14px, padding 18px; 라벨 Space Mono 12px `#5f6878`, 값 Space Mono 20px bold (양수 `#2bd576`, 음수 `#ff5a5a`)
  - 하이라이트 박스: `rgba(255,176,0,.08)` 배경, 좌측 보더 3px `#ffb000`, radius 6px, padding 16px 18px, 텍스트 16px `#d7dce5`

### 3. Theme Ranking (테마 랭킹)
- **Purpose**: 코스피 내 테마별 등락률 순위
- **Layout**: 섹션 라벨 → 랭킹 리스트(5행) → 각주 → 도트
- **Components**: 각 랭킹 행 — flex row, gap 14px, `#11151d` 배경, radius 12px, padding 16px 18px. 순번(Space Mono bold, 상위 3위는 `#ffb000`, 나머지 `#5f6878`, width 20px) / 테마명(18px bold `#eef1f6`, flex:1) / 등락률(Space Mono 18px bold, 양수 `#2bd576`, 보합 `#9aa2b1`, 음수 `#ff5a5a`). 보더 컬러는 등락 방향에 따라 `rgba(43,213,118,.25)`(상승) / `rgba(255,255,255,.08)`(보합) / `rgba(255,90,90,.25)`(하락)

### 4. Theme Deep Dive (테마 상세)
- **Purpose**: 오늘의 1위 테마를 종목 단위로 드릴다운
- **Layout**: 섹션 라벨 → 테마명+등락률 → 설명 문장 → 종목 리스트(3행) → 하이라이트 박스 → 도트
- **Components**: 보더 강조 `1px solid rgba(255,176,0,.2)`. 테마 타이틀 32px bold `#eef1f6` + 등락률 `#2bd576`. 종목 행은 Overview의 3열 카드와 동일한 톤(`#11151d`/`rgba(255,255,255,.07)` 보더, radius 12px)이지만 좌우 justify-between 레이아웃(종목명 17px bold / 등락률 Space Mono 17px bold)

### 5. Closing (마무리)
- **Purpose**: 오늘 요약 3줄 + 팔로우 유도
- **Layout**: 섹션 라벨 → 번호 매긴 요약 리스트(3행) → CTA 박스 → 디스클레이머 → 도트
- **Background**: Cover와 동일한 격자+보더 스타일(시작/끝 슬라이드 통일감)
- **Components**: 요약 행 — 번호(Space Mono bold `#ffb000`) + 텍스트(17px `#dfe3ea`). CTA 박스: 배경 `#ffb000` 통짜, radius 16px, padding 20px, 텍스트는 다크(`#1a1205`) — 타이틀 18px bold, 서브(팔로우 안내) Space Mono 16px bold. 디스클레이머 12px `#5f6878`

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
