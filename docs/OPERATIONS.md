# Operations Notes

## Intended Use
- Primary target page: `순위 > 조회수 순위` (`/stat/rank_pv`).
- Use date range mode only when needed.

## Policy Constraints
- Maximum date range is 7 days.
- Extract always attempts to start from page 1 for completeness.
- Output schema is fixed and stable.

## Performance Considerations
- Total run time grows with:
- Number of days.
- Number of pages per day.
- Keep other heavy tabs closed if browser is slow.

## Data Semantics
- `날짜`: selected stats date at top date control.
- `작성일`: post creation date in table.
- `조회수`: ranking table value for selected date context.

## Known Limitations
- Major UI layout changes can break date/pagination element detection.
- Clipboard behavior may vary by browser policy.
