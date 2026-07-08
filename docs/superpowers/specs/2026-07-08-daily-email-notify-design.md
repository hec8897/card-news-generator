# 매일 아침 메일 발송 — 설계

작성일: 2026-07-08

> 이 문서는 [2026-06-28 주식뉴스 카드 자동 발행기 설계](2026-06-28-stock-news-card-generator-design.md)의 연장선입니다.
> 기존 파이프라인(`collect → summarize → render`)은 그대로 두고, 마지막에 **메일 발송** 단계를 추가합니다.

## 목표

매일 아침 자동으로 파이프라인을 실행해, 생성된 카드뉴스(PNG 4장 + 원본 카피)를 본인 메일로 받아본다.
인스타그램 업로드는 이번 범위에서 제외 — 메일로 결과를 확인하는 것까지만.

## 범위

- **포함**: 정보수집(collect) → 카드뉴스 생성(summarize + render) → 메일 전송(notify)
- **제외**: 인스타그램 발행/승인 플로우(기존 설계의 Phase 2, 계속 유보), 발송 이력 저장, 웹 대시보드

## 아키텍처

```
collect ──DailyData──▶ summarize ──CardCopy──▶ render ──PNG[]──▶ notify (신규)
```

- 신규 모듈: `src/notify.js`
  - 입력: `CardCopy`, `pngPaths: string[]` (render가 만든 4장의 경로)
  - 동작: `nodemailer`로 Naver SMTP(`smtp.naver.com:465`, SSL) 통해 메일 발송
  - 메일 본문: `CardCopy`의 제목/시황요약/종목픽/마무리를 텍스트로 구성
  - 첨부파일: PNG 4장 그대로 첨부
- `pipeline.js`: 기존 3단계 뒤에 `notify` 호출을 추가. `publish`(인스타 발행)는 기존 설계대로 Phase 2 스텁으로 남겨두고 이번엔 호출하지 않음.

## 설정 (환경변수 추가)

```
NAVER_EMAIL          # 발신 계정 (본인 네이버 계정 아이디, 예: hec8897@naver.com)
NAVER_APP_PASSWORD   # 네이버 메일 설정 > POP3/IMAP/SMTP 에서 발급하는 앱 비밀번호
MAIL_TO=hec8897@naver.com   # 수신자, 기본값 고정 (필요시 override)
```

## 에러 처리

- 기존 설계의 부분 실패 원칙을 유지: `collect` 단계 일부 실패해도 파이프라인은 계속 진행.
- 무엇이 빠졌는지(예: "미국 시황 수집 실패")는 메일 본문 상단에 경고 문구로 표시.
- `notify` 자체가 실패(SMTP 인증 오류 등)하면 파이프라인은 실패로 종료하고 콘솔에 에러 로그 — 메일이 안 갔다는 걸 놓치면 안 되므로 조용히 넘어가지 않음.

## 스케줄링

- 별도 서버 없이 Claude Code의 예약 작업(scheduled task)으로 "매일 아침 N시에 `npm run publish` 실행"을 등록.
- 실행 시각(N시)은 구현 단계에서 사용자가 지정.

## 테스트 전략 (ponytail: 최소 실행 가능 검증)

- `notify`: 샘플 `CardCopy` + 더미 PNG 경로로 실제 SMTP 호출 없이 메일 옵션 객체(수신자/첨부/본문)가 올바르게 구성되는지 assert. `--demo` 플래그로 실제 발송 스킵 가능하게.
- 기존 설계의 `collect --demo`, `render` 스모크 체크와 동일한 방식 유지.

## 범위에서 제외 (YAGNI)

- 인스타그램 자동 업로드/승인 플로우 — 기존 설계의 Phase 2, 이번 라운드에서 다루지 않음.
- 메일 읽음 확인, 발송 이력 DB 저장, 웹 대시보드 — 매일 1회 실행 + 메일함이 곧 이력이므로 불필요.
- 여러 수신자/구독자 관리 — 본인 1인 수신 고정.
