# Architecture

## Goal

`extension-unified` 하나로 다음 두 작업을 수행합니다.
- 원본 순위 테이블 추출
- 최근 기간(7/14일) 상위 글 집계

## Runtime Components

- `extension-unified/manifest.json`: 권한, 매치 범위, 메타데이터.
- `extension-unified/popup.html`: 모드 전환 UI.
- `extension-unified/popup.js`: 옵션 검증, 프레임 선택, 추출 오케스트레이션, CSV/복사 처리.
- `extension-unified/content.js`: 페이지 내 테이블 탐지, 날짜 이동, 페이지네이션 수집.
- `extension-unified/icons/*`: 웹스토어/툴바 아이콘.

## Execution Flow

1. 사용자가 popup에서 모드 선택 후 `Extract` 클릭.
2. popup이 옵션을 검증.
- 상위 글 집계 모드: 최근 7/14일 계산(종료일=어제).
- 원본 순위 추출 모드: 현재일 또는 사용자 지정 기간(최대 7일).
3. popup이 활성 탭의 프레임 목록을 조회하고 `EXTRACT_RANK_TABLE` 메시지를 전송.
4. 응답 성공 프레임 중 우선순위/rowCount 기준으로 최적 프레임을 선택.
5. 결과를 미리보기로 렌더링하고 `Download CSV`/`Copy`를 활성화.

## Content Script Flow

1. 필수 헤더(`순위`, `제목`, `조회수`, `타입`, `작성일`)를 기준으로 타깃 테이블 탐지.
2. 화면 기준 날짜(`YYYY-MM-DD`) 추출.
3. 요청 범위의 각 날짜에 대해:
- 목표 날짜로 이동(input 우선, 화살표 fallback)
- 1페이지로 리셋 시도
- 다음 페이지가 없을 때까지 수집
4. 결과를 dedupe 후 popup에 반환.

## Message Contract

- Request:
- `type: "EXTRACT_RANK_TABLE"`
- `options: { rangeEnabled: boolean, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }`
- Response:
- `ok: true | false`
- `rows: Array<Row>`
- `metadata: pageCount, rangeStart, rangeEnd, stopReason, rowCount ...`

## Non-Goals

- 백엔드 서버 없음.
- 외부 API 키 관리 없음.
- 빌드 단계 없음(Plain JS/HTML/CSS).
