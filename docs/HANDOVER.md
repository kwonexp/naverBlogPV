# Handover Guide

## Project Location
- Root: project root (`.`)
- Extension source: `extension/`

## Core Files
- `manifest.json`: permissions, matches, extension metadata.
- `popup.html/css/js`: UI and user-side orchestration.
- `content.js`: extraction engine and page control logic.

## First Steps for New Maintainer
1. Read:
- `docs/ARCHITECTURE.md`
- `docs/FEATURES.md`
- `docs/OPERATIONS.md`
2. Run syntax checks:
- `node --check extension/content.js`
- `node --check extension/popup.js`
3. Load extension in Chrome and run smoke test.

## Safe Change Process
1. Make one scoped change at a time.
2. Run checklist in `docs/TEST_CHECKLIST.md`.
3. Update `CHANGELOG.md`.
4. Bump version in `manifest.json`.

## When Extraction Breaks
1. Capture popup error message.
2. Capture current URL and visible date text.
3. Inspect popup/content script console logs.
4. Follow `docs/TROUBLESHOOTING.md`.
