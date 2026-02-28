# Troubleshooting

## 1) "추출 가능한 테이블을 찾지 못했습니다."
- Confirm page path is `.../stat/rank_pv`.
- Refresh both:
- Extension (`chrome://extensions` -> Reload).
- Naver stats page tab.
- Ensure you are logged in and table is visible.

## 2) "상단 기준 날짜를 찾지 못했습니다."
- Ensure date selector text is visible near title/date controls.
- Remove overlays/modals and retry.
- Try page refresh and run extract again.

## 3) "1페이지로 이동하지 못했습니다."
- Current pagination control did not respond.
- Refresh page and retry.
- Confirm pagination controls `< 1 2 >` are visible and clickable.

## 4) Range extraction fails on specific day
- Check selected range is within 7 days.
- Confirm each target day is reachable via current UI controls.
- Retry with smaller range (2-3 days) to isolate problematic date.

## 5) Copy does not work
- Some environments restrict clipboard API.
- Use `Download CSV` as fallback.
- Retry after clicking popup body once (focus issue).

## 6) Debugging checklist
- Open `chrome://extensions`.
- Open popup DevTools and inspect errors.
- Capture:
- Active URL.
- Selected range values.
- Popup error text.
- Console error stack.
