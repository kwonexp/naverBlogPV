# 네이버 블로그 통계 CSV 추출기

로그인된 네이버 블로그 통계 페이지에서 데이터를 CSV로 저장합니다.

## 문서 안내

유지보수/인수인계 문서는 아래를 참고하세요.
- `docs/README.md`
- `CHANGELOG.md`

## 크롬 익스텐션 버전 (추천)

프로젝트 루트의 `extension/` 폴더에 Manifest V3 익스텐션이 포함되어 있습니다.

### 1) 익스텐션 로드

1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 `개발자 모드` ON
3. `압축해제된 확장 프로그램을 로드합니다` 클릭
4. 프로젝트 루트의 `extension/` 폴더 선택

### 2) 사용

1. 네이버 로그인 후 블로그 통계 페이지를 연 상태에서
   - 권장: `순위 > 조회수 순위` (`/stat/rank_pv`)
2. 익스텐션 아이콘 클릭
3. 필요 시 `기간 추출 사용`을 켜고 시작일/종료일 지정 (최대 7일)
4. `Extract` 클릭
   - 기본 모드: 현재 화면 기준 1일 추출
   - 기간 모드: 지정한 날짜를 하루씩 이동하며 각 날짜의 `1,2,>` 전체 페이지를 자동 수집
   - 현재 페이지가 2 이상이면 먼저 1페이지로 이동한 뒤 수집
5. 데이터가 보이면 `Download CSV` 또는 `Copy` 클릭

CSV는 화면의 다음 컬럼을 그대로 저장합니다.
- `날짜` (조회수 순위 화면 상단 기준 날짜)
- `순위`
- `제목`
- `조회수`
- `타입`
- `작성일`

### 3) 값이 안 잡힐 때

- 확장 프로그램/통계 페이지를 모두 새로고침 후 다시 시도하세요. (iframe 반영)
- 탭이 `순위 > 조회수 순위` 화면인지 확인하세요.

## 1) 설치

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

## 2) 크롬 실행 (원격 디버깅)

아래 명령으로 크롬을 켠 뒤, 네이버 로그인 + 블로그 통계 페이지를 열어두세요.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-naver-blog-pv"
```

## 3) 추출 실행

```bash
python3 export_naver_daily_views.py --output naver_daily_views.csv
```

성공하면 `date,views` 형식의 CSV가 생성됩니다. (엑셀/구글 스프레드시트에서 바로 열 수 있음)

## 옵션

- `--url-contains`: 대상 탭 URL 필터 (기본: `blog.naver.com`)
- `--row-selector`: 자동 감지가 실패할 때 통계 행 CSS 선택자 직접 지정
- `--date-column`: 날짜 컬럼 인덱스 (기본: `0`)
- `--views-column`: 조회수 컬럼 인덱스 (기본: `1`)
- `--year`: 연도 없는 날짜(`02.28` 등)에 사용할 기준 연도
- `--wait-ms`: 탭 활성화 후 대기 시간(ms)

예시 (조회수가 3번째 컬럼일 때):

```bash
python3 export_naver_daily_views.py --views-column 2 --output views.csv
```

예시 (행 선택자 지정):

```bash
python3 export_naver_daily_views.py --row-selector "table.stats-table tbody tr"
```
