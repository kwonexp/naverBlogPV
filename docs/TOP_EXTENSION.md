# Top Aggregation Extension (`extension-top`, Legacy)

> This document is for historical reference only. Current Chrome Web Store target is `extension-unified/`.

## Goal
Collect recent ranking data from Naver Blog stats and aggregate by `제목 + 작성일` to find top posts by summed views.

## Target Page
- Naver Blog stats `순위 > 조회수 순위` (`/stat/rank_pv`)

## What It Does
- Period options: `최근 7일` or `최근 14일`
- Auto-crawl each day in the selected period
- Aggregate duplicate posts by `제목 + 작성일`
- Sort by summed views descending
- Show `Top 10` in preview
- Export full result via CSV/Copy

## Date Rule (Important)
- Naver Blog stats does not provide same-day stats.
- So this extension always uses **yesterday** as the period end date.
- Example (fixed date):
- If today is `2026-02-28`
- Recent 7 days = `2026-02-21 ~ 2026-02-27`
- Recent 14 days = `2026-02-14 ~ 2026-02-27`

## Output Schema
- `기간`
- `순위`
- `제목`
- `합계조회수`
- `타입`
- `작성일`

## Notes
- The original extractor extension remains in `extension/`.
- This top aggregation logic is isolated in `extension-top/` to avoid feature coupling.
