# Handover Guide

## Project Location

- Root: `.`
- Extension source: `extension-unified/`

## Core Files

- `extension-unified/manifest.json`: 권한/매치 범위/메타데이터.
- `extension-unified/popup.html/css/js`: 모드 UI 및 사용자 액션 처리.
- `extension-unified/content.js`: 추출 엔진과 페이지 제어 로직.

## First Steps for New Maintainer

1. 문서 확인:
- `docs/ARCHITECTURE.md`
- `docs/FEATURES.md`
- `docs/OPERATIONS.md`
- `docs/CWS_SUBMISSION.md`
- `docs/PRIVACY.md`
2. 문법 검사:
- `node --check extension-unified/content.js`
- `node --check extension-unified/popup.js`
3. Chrome 로드 후 `docs/TEST_CHECKLIST.md` 수행.

## Safe Change Process

1. 작은 범위로 변경.
2. `docs/TEST_CHECKLIST.md` 실행.
3. `CHANGELOG.md` 갱신.
4. `manifest.json` 버전 갱신.

## When Extraction Breaks

1. popup 에러 메시지 캡처.
2. 활성 URL과 화면 날짜 텍스트 캡처.
3. popup/content script 콘솔 에러 확인.
4. `docs/TROUBLESHOOTING.md` 순서대로 점검.
