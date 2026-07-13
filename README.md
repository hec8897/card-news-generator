# card-news-generator

주식뉴스 인스타그램 카드 자동 발행기. 매일 명령어 한 번으로
**데이터 수집 → AI 요약 → PNG 캐러셀 렌더 → 인스타그램 발행**까지 도는 파이프라인.

- 계정 콘셉트: `@마켓노트` (주식 시황/종목 뉴스 카드)
- 캐러셀: 커버 → 시황요약 → 종목픽 → 마무리 (4장, 1080×1350, 4:5)
- 시장: 한국(코스피/코스닥) + 미국(S&P500/나스닥)

> 상세 설계는 [docs/superpowers/specs/2026-06-28-stock-news-card-generator-design.md](docs/superpowers/specs/2026-06-28-stock-news-card-generator-design.md) 참고.

## 현재 상태

Phase 1 구현 완료: 수집 → AI 요약 → PNG 렌더 → 메일 발송까지 `node bin/publish.js`로 동작.
인스타그램 자동 발행(Phase 2)은 아직 미구현.

## 파이프라인

```
collect ──DailyData──▶ summarize ──CardCopy──▶ render ──PNG[]──▶ notify
```

| 단계 | 역할 | 기술 |
|---|---|---|
| collect | 시황·종목·뉴스 수집 | FRED CSV(US), 네이버 금융 JSON(KR), RSS |
| summarize | DailyData → CardCopy | OpenAI SDK, `gpt-5.5`, 구조화 출력(json_schema) |
| render | CardCopy → PNG 4장 | Playwright(chromium) headless |
| notify | PNG + 카드 문구 → 메일 발송 | Nodemailer (네이버 SMTP) |
| publish | PNG → IG 캐러셀 | Instagram Graph API (Phase 2) |

## 단계 구성

- **Phase 1** — 데이터 수집 → AI 요약 → PNG 4장 생성 → 매일 아침 메일로 발송(첨부: PNG 4장, 본문: 카드 문구 텍스트). 인스타는 수동 업로드.
- **Phase 2** — IG 비즈니스 계정 + 토큰 준비 후 자동 발행 연결.

## 사용

```bash
npm install
cp .env.example .env   # 아래 "환경변수" 참고해 값 채우기
npm run publish              # 전체 파이프라인 (수집 → 요약 → 렌더 → 메일 발송)
node bin/publish.js --style neon
node bin/publish.js --demo   # 수집/발송을 고정 샘플·미발송으로 대체 (요약은 실제 API 호출)
```

- `--style <neon>` — 카드 디자인 시안 선택 (기본값은 `STYLE` 환경변수, 그마저 없으면 `neon`). 현재는 `neon`만 지원하며, 다른 값을 넘기면 명확한 에러로 실패한다.
- `--demo` — `collectDaily`가 KR/US/뉴스 수집을 고정 샘플 데이터로 대체하고, 메일은 실제 발송 없이 발송될 내용만 반환한다. 단, `summarize` 단계는 `--demo`의 영향을 받지 않고 항상 `OPENAI_API_KEY`로 실제 OpenAI API를 호출한다 (의도된 제약; CLI에 요약을 가짜로 대체하는 옵션은 없음).

## 환경변수

`.env.example`을 복사해 `.env`를 만들고 값을 채운다 (`.env`는 gitignore됨). `bin/publish.js`가 실행 시 `.env`를 자동 로드한다.

```
OPENAI_API_KEY         # 필수 (요약 단계, --demo 여부와 무관하게 항상 필요)
NAVER_EMAIL            # 필수 (발송 계정, SMTP 인증 아이디이자 메일의 발신 주소)
NAVER_APP_PASSWORD     # 필수 (네이버 앱 비밀번호, 로그인 비밀번호 아님)
MAIL_TO=hec8897@naver.com  # 수신 주소 (미설정 시 NAVER_EMAIL로 발송)
STYLE=neon             # 기본 시안 (현재 neon만 지원, 다른 값이면 에러)
IG_ACCESS_TOKEN        # Phase 2
IG_USER_ID             # Phase 2
PUBLIC_IMAGE_BASE_URL  # Phase 2 (이미지 호스팅)
```

### 네이버 앱 비밀번호 발급

메일 발송은 네이버 SMTP(`smtp.naver.com:465`)를 사용하며, 로그인 비밀번호가 아닌 **앱 비밀번호**가 필요하다.

1. 네이버 메일 접속 → **환경설정**
2. **POP3/IMAP/SMTP 설정** 메뉴로 이동해 사용 설정
3. 사용 설정 후 노출되는 **앱 비밀번호 발급** 메뉴에서 비밀번호 생성
4. 발급된 값을 `.env`의 `NAVER_APP_PASSWORD`에 입력
