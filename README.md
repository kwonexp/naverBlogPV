# 네이버 블로그 조회수 순위 통합 도구

로그인된 네이버 블로그 통계 페이지에서 조회수 순위 데이터를 추출/집계해 CSV로 저장하는 Chrome Extension (Manifest V3) 프로젝트입니다.

## 문서 안내

- `docs/README.md`
- `CHANGELOG.md`

## 크롬 익스텐션 (제출 대상)

웹스토어 등록/배포 대상은 `extension-unified/` 폴더 하나입니다.

### 1) 익스텐션 로드

1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 `개발자 모드` ON
3. `압축해제된 확장 프로그램을 로드합니다` 클릭
4. 프로젝트 루트의 `extension-unified/` 폴더 선택

### 2) 사용

1. 네이버 로그인 후 `순위 > 조회수 순위` (`/stat/rank_pv`) 페이지 오픈
2. 익스텐션 아이콘 클릭
3. 작업 모드 선택
- `상위 글 집계 (7/14일)`:
- 최근 7일 또는 14일을 자동 수집 후 `제목 + 작성일` 기준으로 합계 집계
- 네이버 통계 특성상 오늘 데이터는 제외하고 어제를 종료일로 사용
- 예시: 오늘이 `2026-02-28`이면 최근 7일은 `2026-02-21 ~ 2026-02-27`
- `원본 순위 추출`:
- 현재 화면 1일 추출 또는 사용자 지정 기간 추출(최대 7일)
4. `Extract` 클릭
5. 결과 확인 후 `Download CSV` 또는 `Copy` 클릭

### 3) 값이 안 잡힐 때

- 확장 프로그램/통계 페이지를 모두 새로고침 후 재시도
- 경로가 `.../stat/rank_pv`인지 확인
- `docs/TROUBLESHOOTING.md` 참고

## 권한/데이터 처리 요약

- 권한: `downloads`, `webNavigation`, `clipboardWrite`
- 접근 도메인: `https://blog.stat.naver.com/*`
- 수집 데이터는 브라우저 내에서만 처리되며 외부 서버로 전송하지 않음

자세한 내용:
- `docs/CWS_SUBMISSION.md`
- `docs/PRIVACY.md`

## 내부 배포

배포/업데이트 절차는 `docs/RELEASE.md`를 참고하세요.

## 레거시 폴더

`extension/`, `extension-top/`는 분리 실험 버전이며 현재 등록 대상이 아닙니다.
