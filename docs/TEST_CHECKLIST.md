# Test Checklist

## Smoke Test
- Load extension successfully.
- Open `.../stat/rank_pv`.
- Extract in default mode.
- Verify preview shows max 20 rows.
- Verify status text shows total rows.

## CSV / Copy
- Download CSV and open in spreadsheet.
- Use Copy and paste into spreadsheet.
- Verify 6 columns:
- 날짜, 순위, 제목, 조회수, 타입, 작성일

## Pagination
- Start from page 2 or later.
- Run extract.
- Confirm page 1 rows are included.
- Confirm full pages are crawled once.

## Range Mode
- Enable range mode and set 2-day period.
- Confirm merged output includes both dates.
- Enable 7-day period and verify success.
- Set 8-day period and verify validation error.

## Robustness
- Refresh extension and page, run extract again.
- Validate duplicate rows are filtered.
- Validate errors are shown in status if extraction fails.
