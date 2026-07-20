#!/bin/bash
# 1차 10:00, 실패 시 30분 간격으로 12:00까지 재시도 (launchd StartCalendarInterval 배열과 함께 사용).
# 오늘 이미 성공했으면 마커 파일을 보고 건너뛴다.
set -euo pipefail
cd "$(dirname "$0")/.."

MARKER_DIR="logs/.done"
MARKER_FILE="$MARKER_DIR/$(date +%Y-%m-%d)"
mkdir -p "$MARKER_DIR"

if [ -f "$MARKER_FILE" ]; then
  echo "오늘($(date +%Y-%m-%d))은 이미 발송 완료됨, 건너뜀"
  exit 0
fi

if /opt/homebrew/bin/node bin/publish.ts; then
  touch "$MARKER_FILE"
else
  echo "실패 — 다음 재시도 때 다시 시도"
  exit 1
fi
