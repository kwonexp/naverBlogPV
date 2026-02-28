# Changelog

## 2026-02-28
- Added Chrome extension (Manifest V3) for Naver Blog rank table extraction.
- Added CSV download and clipboard copy output.
- Added fixed schema output: `날짜 / 순위 / 제목 / 조회수 / 타입 / 작성일`.
- Added automatic pagination crawl (`1, 2, >`) for full-page extraction.
- Added forced reset to page 1 before extraction.
- Added optional date-range extraction mode (max 7 days) using UI controls.
- Added separate `extension-top/` extension for recent-period top-view aggregation:
- Period options: recent 7 days / 14 days.
- Date policy: exclude today and use yesterday as period end (Naver same-day stats unavailable).
- Aggregate by `title + createdAt`.
- Preview top 10 aggregated posts.
- Added docs for architecture, operations, troubleshooting, release, and handover.
- Unified store target to `extension-unified/` single extension package.
- Reduced `extension-unified` manifest scope for CWS review:
- Removed unnecessary `activeTab` and `tabs` permissions.
- Restricted content script match scope to `https://blog.stat.naver.com/*`.
- Added extension icons (`16/48/128`) for store listing quality.
- Added CWS documentation:
- `docs/CWS_SUBMISSION.md`
- `docs/PRIVACY.md`
- Updated root/docs guides to `extension-unified` as primary release target.
