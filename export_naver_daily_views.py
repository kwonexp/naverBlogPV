#!/usr/bin/env python3
"""Export Naver Blog daily views from an already opened stats page.

Workflow:
1) Open Chrome with remote debugging enabled.
2) Log in to Naver and open the blog stats page.
3) Run this script to attach to the open tab and export daily views to CSV.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Iterable, List, Optional, Tuple

if TYPE_CHECKING:
    from playwright.async_api import Browser, Page


DEFAULT_ROW_SELECTORS = [
    "table tbody tr",
    "table tr",
    "[role='row']",
    ".list_table tbody tr",
    ".tb_type tbody tr",
]

DATE_PATTERNS: List[re.Pattern[str]] = [
    re.compile(
        r"(?P<y>20\d{2})\s*(?:[./-]|년)\s*(?P<m>\d{1,2})\s*(?:[./-]|월)\s*(?P<d>\d{1,2})"
    ),
    re.compile(r"(?P<m>\d{1,2})\s*[./-]\s*(?P<d>\d{1,2})"),
    re.compile(r"(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일"),
]
NUMBER_PATTERN = re.compile(r"\d[\d,]*")


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def find_date(text: str, default_year: int) -> Optional[Tuple[dt.date, Tuple[int, int]]]:
    normalized = clean_text(text)
    for pattern in DATE_PATTERNS:
        match = pattern.search(normalized)
        if not match:
            continue
        try:
            year = int(match.groupdict().get("y") or default_year)
            month = int(match.group("m"))
            day = int(match.group("d"))
            return dt.date(year, month, day), match.span()
        except ValueError:
            continue
    return None


def find_number(text: str) -> Optional[int]:
    numbers = [int(token.replace(",", "")) for token in NUMBER_PATTERN.findall(clean_text(text))]
    if not numbers:
        return None
    return max(numbers)


def parse_row(
    cells: List[str],
    joined_text: str,
    default_year: int,
    date_column: int,
    views_column: int,
) -> Optional[Tuple[dt.date, int]]:
    date_info: Optional[Tuple[dt.date, Tuple[int, int]]] = None

    if 0 <= date_column < len(cells):
        date_info = find_date(cells[date_column], default_year)
    if not date_info:
        for cell in cells:
            date_info = find_date(cell, default_year)
            if date_info:
                break
    if not date_info:
        date_info = find_date(joined_text, default_year)
    if not date_info:
        return None

    parsed_date, date_span = date_info

    views: Optional[int] = None
    if 0 <= views_column < len(cells):
        views = find_number(cells[views_column])

    if views is None:
        candidate_cells = []
        for idx, cell in enumerate(cells):
            if idx == date_column:
                continue
            candidate_cells.append(cell)

        for cell in candidate_cells:
            value = find_number(cell)
            if value is not None:
                views = value
                break

    if views is None:
        trimmed = joined_text[: date_span[0]] + " " + joined_text[date_span[1] :]
        views = find_number(trimmed)

    if views is None:
        return None

    return parsed_date, views


async def list_candidate_rows(page: Page, row_selector: Optional[str]) -> List[dict]:
    selectors = [row_selector] if row_selector else DEFAULT_ROW_SELECTORS
    return await page.evaluate(
        """(selectors) => {
            const out = [];
            for (const selector of selectors) {
                const rows = document.querySelectorAll(selector);
                rows.forEach((row) => {
                    const directCells = Array.from(row.querySelectorAll("th, td"));
                    let cells = directCells.map((el) => (el.textContent || "").trim()).filter(Boolean);
                    if (!cells.length) {
                        cells = Array.from(row.children)
                            .map((el) => (el.textContent || "").trim())
                            .filter(Boolean);
                    }
                    if (!cells.length) return;

                    const joined = cells.join(" ").replace(/\\s+/g, " ").trim();
                    if (!joined) return;

                    out.push({
                        selector,
                        cells,
                        text: joined,
                    });
                });
            }
            return out;
        }""",
        selectors,
    )


async def pick_target_page(browser: Browser, url_contains: Optional[str]) -> Page:
    pages: List[Page] = []
    for context in browser.contexts:
        pages.extend(context.pages)

    if not pages:
        raise RuntimeError("열려 있는 크롬 탭을 찾지 못했습니다.")

    if url_contains:
        for page in reversed(pages):
            if url_contains in page.url:
                return page
        raise RuntimeError(
            f"URL에 '{url_contains}' 문자열이 포함된 탭을 찾지 못했습니다. "
            "옵션 값을 확인하거나 생략해 보세요."
        )

    return pages[-1]


def write_csv(path: Path, rows: Iterable[Tuple[dt.date, int]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "views"])
        for day, views in rows:
            writer.writerow([day.isoformat(), views])


async def run(args: argparse.Namespace) -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover - runtime dependency error
        raise RuntimeError(
            "playwright 가 설치되어 있지 않습니다. "
            "설치: pip install playwright / python -m playwright install chromium"
        ) from exc

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(args.cdp_endpoint)
        try:
            page = await pick_target_page(browser, args.url_contains)
            await page.bring_to_front()
            await page.wait_for_timeout(args.wait_ms)

            row_dicts = await list_candidate_rows(page, args.row_selector)
            if not row_dicts:
                raise RuntimeError(
                    "통계 행을 찾지 못했습니다. --row-selector 옵션으로 행 선택자를 지정해 보세요."
                )

            parsed: List[Tuple[dt.date, int]] = []
            for item in row_dicts:
                result = parse_row(
                    cells=[clean_text(x) for x in item["cells"]],
                    joined_text=clean_text(item["text"]),
                    default_year=args.year,
                    date_column=args.date_column,
                    views_column=args.views_column,
                )
                if result:
                    parsed.append(result)

            if not parsed:
                raise RuntimeError(
                    "일자/조회수 데이터를 추출하지 못했습니다. "
                    "--date-column, --views-column, --row-selector 값을 조정해 보세요."
                )

            by_date: dict[dt.date, int] = {}
            conflicts = 0
            for day, views in parsed:
                if day in by_date and by_date[day] != views:
                    conflicts += 1
                    by_date[day] = max(by_date[day], views)
                else:
                    by_date[day] = views

            rows = sorted(by_date.items(), key=lambda x: x[0])
            output = Path(args.output).expanduser().resolve()
            write_csv(output, rows)

            print(f"완료: {len(rows)}개 일자 데이터를 저장했습니다.")
            print(f"파일: {output}")
            if conflicts:
                print(
                    f"참고: 같은 날짜에 서로 다른 값이 {conflicts}건 발견되어 큰 값으로 정리했습니다."
                )
            return 0
        finally:
            await browser.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="열려 있는 네이버 블로그 통계 탭에서 일자별 조회수를 CSV로 내보냅니다."
    )
    parser.add_argument(
        "--cdp-endpoint",
        default="http://127.0.0.1:9222",
        help="원격 디버깅 크롬 CDP 엔드포인트 (기본값: %(default)s)",
    )
    parser.add_argument(
        "--url-contains",
        default="blog.naver.com",
        help="대상 탭 URL에 포함되어야 하는 문자열 (기본값: %(default)s)",
    )
    parser.add_argument(
        "--row-selector",
        default=None,
        help="통계 행 선택자(CSS). 자동 감지가 실패하면 지정하세요.",
    )
    parser.add_argument(
        "--date-column",
        type=int,
        default=0,
        help="일자 컬럼 인덱스(0부터 시작, 기본값: %(default)s)",
    )
    parser.add_argument(
        "--views-column",
        type=int,
        default=1,
        help="조회수 컬럼 인덱스(0부터 시작, 기본값: %(default)s)",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=dt.date.today().year,
        help="연도가 표시되지 않은 날짜에 사용할 기준 연도 (기본값: 올해)",
    )
    parser.add_argument(
        "--wait-ms",
        type=int,
        default=1200,
        help="탭 활성화 후 데이터 로딩 대기 시간(ms, 기본값: %(default)s)",
    )
    parser.add_argument(
        "--output",
        default="naver_daily_views.csv",
        help="출력 CSV 파일 경로 (기본값: %(default)s)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        return 130
    except Exception as exc:  # pragma: no cover - CLI error handling
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
