# Chrome Web Store Submission Checklist

## Submission Target

- 제출 폴더: `extension-unified/` 단일 패키지
- 현재 버전: `extension-unified/manifest.json` 기준

## Permission Scope Check

현재 선언:
- `downloads`: CSV 저장
- `webNavigation`: 활성 탭 프레임 목록 조회
- `clipboardWrite`: 결과 복사

호스트 매치:
- `https://blog.stat.naver.com/*`

제출 전 확인:
- 불필요 권한 추가 여부 재확인
- 기능 설명과 권한 사유가 1:1 대응되는지 확인

## Suggested Store Description Points

- 단일 목적: 네이버 블로그 통계 `조회수 순위` 화면 데이터 추출/집계
- 모드:
- 원본 순위 추출(현재일/최대 7일)
- 상위 글 집계(최근 7/14일)
- 데이터 처리:
- 브라우저 내부 처리
- 외부 서버 전송 없음

## Privacy Practices (CWS Form)

작성 시 반영 항목:
- 개인 데이터 판매/전송 없음
- 인증정보/개인식별정보 수집 없음
- 사용자 요청 시(Extract/Download/Copy)에만 동작
- 자세한 정책 URL: `docs/PRIVACY.md`를 공개 URL로 게시한 링크 사용

## Packaging

```bash
cd <project-root>
zip -r naver-rank-toolkit-unified.zip extension-unified -x "*/.DS_Store"
```

## Pre-Submit Verification

- `node --check extension-unified/content.js`
- `node --check extension-unified/popup.js`
- `docs/TEST_CHECKLIST.md` 완료
- 아이콘(16/48/128) 포함 확인
- 스토어 스크린샷/설명 최신화

## Store Screenshots

- `screenshot20260304.png` (918x658)
- `screenshot20260304_640x400.png` (640x400)
