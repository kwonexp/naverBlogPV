# Architecture

## Goal
Extract Naver Blog `순위 > 조회수 순위` table data and export it as CSV/clipboard text with a stable schema.

## Runtime Components
- `extension/manifest.json`: extension metadata, permissions, script injection targets.
- `extension/popup.html`: user UI (extract, download, copy, optional date range).
- `extension/popup.js`: orchestration layer, validation, frame selection, output actions.
- `extension/content.js`: in-page extractor engine (table detection, date/page navigation, data collection).

## Execution Flow
1. User clicks `Extract` in popup.
2. Popup validates options.
- Default mode: current screen date only.
- Range mode: `startDate ~ endDate`, max 7 days.
3. Popup sends `EXTRACT_RANK_TABLE` message to all frames in the active tab.
4. Popup picks the best successful frame response (largest `rowCount`).
5. Popup renders top 20 rows in preview and enables `Download CSV` and `Copy`.

## Content Script Flow
1. Find the target table by matching required headers:
- `순위`, `제목`, `조회수`, `타입`, `작성일`
2. Resolve active display date (`YYYY-MM-DD`) from visible date controls/text.
3. For each requested date:
- Move to the requested date (input first, arrow navigation fallback).
- Move to page 1 if currently at page 2+.
- Crawl all pages using next pagination token until no next page.
4. Merge and dedupe rows with fixed output fields:
- `date`, `rank`, `title`, `views`, `type`, `createdAt`

## Message Contract
- Request:
- `type: "EXTRACT_RANK_TABLE"`
- `options: { rangeEnabled: boolean, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }`
- Response:
- `ok: true | false`
- `rows: Array<Row>`
- `metadata: extraction diagnostics (pageCount, rangeStart, rangeEnd, stopReason, etc.)`

## Non-Goals
- No backend service.
- No API key management.
- No build/compile step. Plain JS/HTML/CSS only.
