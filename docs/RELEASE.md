# Release Guide (Internal)

## Versioning Rule

- `extension-unified/manifest.json`의 semantic version 사용.
- 증가 기준:
- Patch: 버그 수정
- Minor: 하위 호환 기능 추가
- Major: 비호환 변경

## Internal Packaging

1. `extension-unified/manifest.json` 버전 업데이트.
2. 문법 검사:
- `node --check extension-unified/content.js`
- `node --check extension-unified/popup.js`
3. 패키징:
- `cd <project-root>`
- `zip -r naver-rank-toolkit-unified.zip extension-unified -x "*/.DS_Store"`

## Chrome Web Store Submission Prep

1. 제출 폴더를 `extension-unified/`로 고정.
2. 권한/매치 범위 변경 시 `docs/CWS_SUBMISSION.md`의 사유 문구 갱신.
3. `docs/PRIVACY.md` 최신화 후 공개 URL 준비.
4. 스토어 스크린샷/설명 문구 업데이트.

## Install on Another Machine

1. `naver-rank-toolkit-unified.zip` 전달.
2. 압축 해제.
3. `chrome://extensions` 접속.
4. Developer mode ON.
5. `Load unpacked` 클릭.
6. 압축 해제한 `extension-unified` 폴더 선택.

## Updating Existing Install

1. 로컬 폴더 파일 교체.
2. `chrome://extensions`에서 해당 확장 `Reload`.
3. 대상 탭 새로고침.
