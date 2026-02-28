# Features

## Completed Features
- Extract table schema:
- `날짜 / 순위 / 제목 / 조회수 / 타입 / 작성일`
- Extract from Naver admin stats iframe (`blog.stat.naver.com`) automatically.
- Auto-detect target table by header names.
- Auto-crawl all pagination pages in one run.
- Force reset to page 1 before crawling.
- Download full result as UTF-8 BOM CSV.
- Copy full result as TSV for spreadsheet paste.
- Optional date-range extraction:
- Toggle in popup.
- Max range = 7 days.
- Per-day full-page crawling and merged output.
- Preview in popup:
- Top 20 rows only.
- Clear status text with total rows and guidance.

## Current Limits
- Designed for `순위 > 조회수 순위` page structure.
- Date movement relies on visible date controls/text and can fail if UI structure changes significantly.
- Range extraction is limited to 7 days by policy.

## Planned/Optional Improvements
- Add explicit progress updates from content script (`n/N days`).
- Add cancel button for long extractions.
- Add smarter table/date selector profiling for layout changes.
