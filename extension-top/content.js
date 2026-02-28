(() => {
  /*
   * Content script responsibilities:
   * - Find the rank table inside the active frame.
   * - Navigate date/page controls when needed.
   * - Return normalized rows to popup via runtime message.
   */
  const REQUIRED_KEYS = ["rank", "title", "views", "type", "createdAt"];
  const HEADER_RULES = [
    { key: "rank", regex: /^(순위|랭킹)$/ },
    { key: "title", regex: /^(제목|게시물|포스트)$/ },
    { key: "views", regex: /^(조회수|pv)$/i },
    { key: "type", regex: /^(타입|유형|종류)$/ },
    { key: "createdAt", regex: /^(작성일|게시일|등록일|일자)$/ }
  ];

  const MAX_PAGE_HOPS = 30;
  const PAGE_WAIT_TIMEOUT_MS = 8000;
  const PAGE_WAIT_INTERVAL_MS = 180;
  const MAX_RANGE_DAYS = 14;
  const TABLE_WAIT_TIMEOUT_MS = 10000;
  const DATE_WAIT_TIMEOUT_MS = 10000;
  const MAX_DATE_ARROW_STEPS = 120;

  // Date/range helpers shared by default mode and range mode.
  function cleanText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatIsoDate(year, month, day) {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  function parseDateText(text) {
    const normalized = cleanText(text);
    const match = normalized.match(
      /(20\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\.?/
    );
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return formatIsoDate(year, month, day);
  }

  function parseIsoDate(iso) {
    const normalized = cleanText(iso);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function dateToIso(date) {
    return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function diffDays(fromIso, toIso) {
    const from = parseIsoDate(fromIso);
    const to = parseIsoDate(toIso);
    if (!from || !to) {
      return null;
    }
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  function enumerateDateRange(startIso, endIso, maxDays) {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    if (!start || !end) {
      throw new Error("기간 날짜 형식이 올바르지 않습니다.");
    }
    if (end.getTime() < start.getTime()) {
      throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
    }

    const days = [];
    const cursor = new Date(start.getTime());
    while (cursor.getTime() <= end.getTime()) {
      days.push(dateToIso(cursor));
      if (days.length > maxDays) {
        throw new Error(`기간 추출은 최대 ${maxDays}일까지 가능합니다.`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function headerKey(text) {
    const normalized = cleanText(text).toLowerCase();
    for (const rule of HEADER_RULES) {
      if (rule.regex.test(normalized)) {
        return rule.key;
      }
    }
    return null;
  }

  function getHeaderCells(table) {
    const theadHeaders = Array.from(table.querySelectorAll("thead th"));
    if (theadHeaders.length) {
      return theadHeaders.map((th) => cleanText(th.textContent));
    }

    const firstHeaderRow = table.querySelector("tr");
    if (!firstHeaderRow) {
      return [];
    }

    const rowHeaders = Array.from(firstHeaderRow.querySelectorAll("th"));
    if (rowHeaders.length) {
      return rowHeaders.map((th) => cleanText(th.textContent));
    }

    return [];
  }

  function buildColumnMap(headers) {
    const map = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headerKey(headers[i]);
      if (!key) {
        continue;
      }
      if (typeof map[key] !== "number") {
        map[key] = i;
      }
    }
    return map;
  }

  function hasAllRequiredColumns(map) {
    return REQUIRED_KEYS.every((key) => typeof map[key] === "number");
  }

  function getDataRows(table) {
    const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));
    if (tbodyRows.length) {
      return tbodyRows;
    }

    const allRows = Array.from(table.querySelectorAll("tr"));
    if (allRows.length <= 1) {
      return [];
    }
    return allRows.slice(1);
  }

  function rowFromCells(cells, map) {
    return {
      date: "",
      rank: cells[map.rank] || "",
      title: cells[map.title] || "",
      views: cells[map.views] || "",
      type: cells[map.type] || "",
      createdAt: cells[map.createdAt] || ""
    };
  }

  function isInsideTable(element) {
    if (!element) {
      return false;
    }
    return Boolean(element.closest("table"));
  }

  function extractSelectedDate() {
    const inputCandidates = Array.from(
      document.querySelectorAll("input[type='date'], input[name*='date' i], input[id*='date' i]")
    );
    for (const input of inputCandidates) {
      const value = cleanText(input.value || input.getAttribute("value") || "");
      const parsed = parseDateText(value);
      if (parsed) {
        return parsed;
      }
    }

    const selectorCandidates = [
      ".calendar",
      ".calendar_box",
      ".date",
      ".date_area",
      ".date_box",
      ".period",
      ".range",
      ".search_date",
      "[class*='date']",
      "[id*='date']"
    ];

    const candidates = [];
    for (const selector of selectorCandidates) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (!isVisible(node) || isInsideTable(node)) {
          continue;
        }
        const text = cleanText(node.textContent);
        if (!text || text.length > 80) {
          continue;
        }
        const parsed = parseDateText(text);
        if (!parsed) {
          continue;
        }
        const rect = node.getBoundingClientRect();
        candidates.push({
          value: parsed,
          top: rect.top,
          left: rect.left
        });
      }
    }

    if (!candidates.length) {
      const scanNodes = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, strong, span, p, div, label, button")
      );
      for (const node of scanNodes) {
        if (!isVisible(node) || isInsideTable(node)) {
          continue;
        }
        const rect = node.getBoundingClientRect();
        if (rect.top < 0 || rect.top > 480) {
          continue;
        }
        const text = cleanText(node.textContent);
        if (!text || text.length > 80) {
          continue;
        }
        const parsed = parseDateText(text);
        if (!parsed) {
          continue;
        }
        candidates.push({
          value: parsed,
          top: rect.top,
          left: rect.left
        });
      }
    }

    if (!candidates.length) {
      return "";
    }

    candidates.sort((a, b) => {
      if (a.top !== b.top) {
        return a.top - b.top;
      }
      return a.left - b.left;
    });
    return candidates[0].value;
  }

  function findDateDisplayElement(dateIso) {
    if (!dateIso) {
      return null;
    }
    const candidates = [];
    const nodes = Array.from(document.querySelectorAll("span, strong, p, div, label, button, a"));
    for (const node of nodes) {
      if (!isVisible(node) || isInsideTable(node)) {
        continue;
      }
      const text = cleanText(node.textContent);
      if (!text || text.length > 80) {
        continue;
      }
      const parsed = parseDateText(text);
      if (parsed !== dateIso) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      candidates.push({
        node,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        textLength: text.length
      });
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => {
      if (a.top !== b.top) {
        return a.top - b.top;
      }
      if (a.left !== b.left) {
        return a.left - b.left;
      }
      if (a.width !== b.width) {
        return a.width - b.width;
      }
      return a.textLength - b.textLength;
    });
    return candidates[0].node;
  }

  function distance(a, b) {
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getDateArrowElement(direction, currentDateIso) {
    const dateDisplay = findDateDisplayElement(currentDateIso);
    const dateRect = dateDisplay ? dateDisplay.getBoundingClientRect() : null;

    const nodes = Array.from(document.querySelectorAll("a, button, span, i, em"));
    const candidates = [];
    for (const node of nodes) {
      if (!isVisible(node) || !isClickableElement(node) || isInsideTable(node)) {
        continue;
      }

      const text = cleanText(node.textContent);
      const className = String(node.className || "").toLowerCase();
      let matched = false;
      if (direction === "prev") {
        matched =
          isPrevToken(text) ||
          /(prev|left|before|back)/.test(className) ||
          node.getAttribute("data-direction") === "prev";
      } else {
        matched =
          isNextToken(text) ||
          /(next|right|after|forward)/.test(className) ||
          node.getAttribute("data-direction") === "next";
      }
      if (!matched) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (dateRect) {
        const center = { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
        const target = {
          left: dateRect.left + dateRect.width / 2,
          top: dateRect.top + dateRect.height / 2
        };
        if (Math.abs(center.top - target.top) > 90 || Math.abs(center.left - target.left) > 260) {
          continue;
        }
        candidates.push({ node, score: distance(center, target) });
      } else {
        candidates.push({ node, score: rect.top + rect.left });
      }
    }

    if (!candidates.length) {
      return null;
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].node;
  }

  function getDateInputCandidates() {
    const selectors = [
      "input[type='date']",
      "input[name*='date' i]",
      "input[id*='date' i]",
      "input[class*='date' i]"
    ];
    const out = [];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (!isVisible(node) || node.readOnly || node.disabled || isInsideTable(node)) {
          continue;
        }
        out.push(node);
      }
    }
    return out;
  }

  function extractRowsFromTable(table, map) {
    const rows = [];
    const dataRows = getDataRows(table);

    for (const tr of dataRows) {
      if (!isVisible(tr)) {
        continue;
      }

      const cells = Array.from(tr.querySelectorAll("td, th")).map((cell) =>
        cleanText(cell.textContent)
      );
      if (!cells.length) {
        continue;
      }

      const row = rowFromCells(cells, map);
      const hasValue = Object.values(row).some(Boolean);
      if (!hasValue) {
        continue;
      }

      rows.push(row);
    }

    return rows;
  }

  function dedupeRows(rows) {
    const seen = new Set();
    const unique = [];
    for (const row of rows) {
      const key =
        `${row.date}||${row.rank}||${row.title}||${row.views}||${row.type}||${row.createdAt}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(row);
    }
    return unique;
  }

  function findBestTargetTable() {
    const tables = Array.from(document.querySelectorAll("table"));
    let best = null;

    for (const table of tables) {
      if (!isVisible(table)) {
        continue;
      }

      const headers = getHeaderCells(table);
      if (!headers.length) {
        continue;
      }

      const columnMap = buildColumnMap(headers);
      if (!hasAllRequiredColumns(columnMap)) {
        continue;
      }

      const rows = extractRowsFromTable(table, columnMap);
      if (!rows.length) {
        continue;
      }

      const score = rows.length;
      if (!best || score > best.score) {
        best = {
          score,
          table,
          headers,
          columnMap,
          rows
        };
      }
    }

    return best;
  }

  // Pagination token parsing for controls like "< 1 2 >".
  function parsePageNumber(text) {
    const normalized = cleanText(text);
    if (!/^\d+$/.test(normalized)) {
      return null;
    }
    return Number(normalized);
  }

  function isNextToken(text) {
    const normalized = cleanText(text).toLowerCase();
    return /^(>|›|»|다음|next)$/.test(normalized);
  }

  function isPrevToken(text) {
    const normalized = cleanText(text).toLowerCase();
    return /^(<|‹|«|이전|prev)$/.test(normalized);
  }

  function isDisabledElement(element) {
    if (!element) {
      return true;
    }
    if (element.disabled) {
      return true;
    }
    if ((element.getAttribute("aria-disabled") || "").toLowerCase() === "true") {
      return true;
    }
    const className = String(element.className || "").toLowerCase();
    if (/(disabled|inactive|off|dim)/.test(className)) {
      return true;
    }
    const style = window.getComputedStyle(element);
    if (style.pointerEvents === "none") {
      return true;
    }
    return false;
  }

  function isClickableElement(element) {
    if (!element || isDisabledElement(element)) {
      return false;
    }
    const tag = (element.tagName || "").toLowerCase();
    if (tag === "a" || tag === "button") {
      return true;
    }
    if (element.hasAttribute("onclick")) {
      return true;
    }
    if ((element.getAttribute("role") || "").toLowerCase() === "button") {
      return true;
    }
    return false;
  }

  function queryPaginationElements(table, scope) {
    const tableRect = table.getBoundingClientRect();
    const nodes = Array.from(scope.querySelectorAll("a, button, span, strong, em"));
    const out = [];

    for (const node of nodes) {
      if (!isVisible(node) || table.contains(node)) {
        continue;
      }

      const text = cleanText(node.textContent);
      const hasPageNumber = parsePageNumber(text) !== null;
      const hasNextToken = isNextToken(text);
      const hasPrevToken = isPrevToken(text);
      const className = String(node.className || "").toLowerCase();
      const hasPageClass = /(page|paging|paginate|next|prev)/.test(className);
      if (!hasPageNumber && !hasNextToken && !hasPrevToken && !hasPageClass) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.bottom < tableRect.bottom - 60 || rect.top > tableRect.bottom + 420) {
        continue;
      }

      out.push(node);
    }

    out.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (ra.top !== rb.top) {
        return ra.top - rb.top;
      }
      return ra.left - rb.left;
    });

    return out;
  }

  function findPaginationInfo(table) {
    const ancestors = [];
    let cursor = table.parentElement;
    while (cursor) {
      ancestors.push(cursor);
      cursor = cursor.parentElement;
      if (ancestors.length >= 8) {
        break;
      }
    }
    ancestors.push(document.body);

    for (const scope of ancestors) {
      const elements = queryPaginationElements(table, scope);
      if (elements.length >= 2) {
        return { scope, elements };
      }
    }

    return {
      scope: document.body,
      elements: queryPaginationElements(table, document.body)
    };
  }

  function getCurrentPage(elements) {
    for (const element of elements) {
      if ((element.getAttribute("aria-current") || "").toLowerCase() === "page") {
        const page = parsePageNumber(element.textContent);
        if (page !== null) {
          return page;
        }
      }
    }

    for (const element of elements) {
      const className = String(element.className || "").toLowerCase();
      if (/(on|current|active|selected)/.test(className)) {
        const page = parsePageNumber(element.textContent);
        if (page !== null) {
          return page;
        }
      }
    }

    for (const element of elements) {
      const tag = (element.tagName || "").toLowerCase();
      if (!["strong", "em", "span", "b"].includes(tag)) {
        continue;
      }
      const page = parsePageNumber(element.textContent);
      if (page !== null) {
        return page;
      }
    }

    return null;
  }

  function getNextPaginationElement(elements, currentPage) {
    for (const element of elements) {
      if (!isClickableElement(element)) {
        continue;
      }
      const text = cleanText(element.textContent);
      const className = String(element.className || "").toLowerCase();
      if (isNextToken(text) || className.includes("next")) {
        return element;
      }
    }

    const numeric = [];
    for (const element of elements) {
      if (!isClickableElement(element)) {
        continue;
      }
      const page = parsePageNumber(element.textContent);
      if (page === null) {
        continue;
      }
      numeric.push({ page, element });
    }

    if (!numeric.length) {
      return null;
    }

    numeric.sort((a, b) => a.page - b.page);
    if (currentPage !== null) {
      for (const item of numeric) {
        if (item.page > currentPage) {
          return item.element;
        }
      }
      return null;
    }

    if (numeric.length === 1) {
      return null;
    }
    return numeric[numeric.length - 1].element;
  }

  function getPageNumberElement(elements, pageNumber, requireClickable) {
    for (const element of elements) {
      const page = parsePageNumber(element.textContent);
      if (page !== pageNumber) {
        continue;
      }
      if (requireClickable && !isClickableElement(element)) {
        continue;
      }
      return element;
    }
    return null;
  }

  function getPrevPaginationElement(elements, currentPage) {
    for (const element of elements) {
      if (!isClickableElement(element)) {
        continue;
      }
      const text = cleanText(element.textContent);
      const className = String(element.className || "").toLowerCase();
      if (isPrevToken(text) || className.includes("prev")) {
        return element;
      }
    }

    const numeric = [];
    for (const element of elements) {
      if (!isClickableElement(element)) {
        continue;
      }
      const page = parsePageNumber(element.textContent);
      if (page === null) {
        continue;
      }
      numeric.push({ page, element });
    }

    if (!numeric.length) {
      return null;
    }

    numeric.sort((a, b) => a.page - b.page);
    if (currentPage !== null) {
      let candidate = null;
      for (const item of numeric) {
        if (item.page < currentPage) {
          candidate = item.element;
        }
      }
      return candidate;
    }

    if (numeric.length <= 1) {
      return null;
    }
    return numeric[0].element;
  }

  function getTableSnapshot(table) {
    const rows = getDataRows(table);
    const firstRows = rows.slice(0, 3).map((row) => cleanText(row.textContent));
    return `${rows.length}::${firstRows.join("||")}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function waitForPageChange(beforeSnapshot, beforePage) {
    const started = Date.now();
    while (Date.now() - started < PAGE_WAIT_TIMEOUT_MS) {
      await sleep(PAGE_WAIT_INTERVAL_MS);
      const best = findBestTargetTable();
      if (!best) {
        continue;
      }

      const afterSnapshot = getTableSnapshot(best.table);
      if (afterSnapshot !== beforeSnapshot) {
        return true;
      }

      const { elements } = findPaginationInfo(best.table);
      const afterPage = getCurrentPage(elements);
      if (beforePage !== null && afterPage !== null && afterPage !== beforePage) {
        return true;
      }
    }
    return false;
  }

  // Date movement strategy: input control first, arrow navigation as fallback.
  async function waitForDateValue(targetIso, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const current = extractSelectedDate();
      if (current === targetIso) {
        return true;
      }
      await sleep(PAGE_WAIT_INTERVAL_MS);
    }
    return false;
  }

  async function setDateByInput(targetIso) {
    const inputs = getDateInputCandidates();
    if (!inputs.length) {
      return false;
    }

    const [y, m, d] = targetIso.split("-");
    const candidates = [targetIso, `${y}.${m}.${d}.`, `${y}.${m}.${d}`, `${y}/${m}/${d}`];
    for (const input of inputs) {
      const tryValues = input.type === "date" ? [targetIso] : candidates;
      for (const value of tryValues) {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));

        const ok = await waitForDateValue(targetIso, 1600);
        if (ok) {
          return true;
        }
      }
    }
    return false;
  }

  async function moveDateByArrows(targetIso) {
    let currentIso = extractSelectedDate();
    if (!currentIso) {
      return false;
    }
    if (currentIso === targetIso) {
      return true;
    }

    const diff = diffDays(currentIso, targetIso);
    if (diff === null || diff === 0) {
      return currentIso === targetIso;
    }
    const direction = diff > 0 ? "next" : "prev";
    const desiredSteps = Math.abs(diff);
    const maxSteps = Math.min(MAX_DATE_ARROW_STEPS, desiredSteps + 14);

    for (let step = 0; step < maxSteps; step += 1) {
      const best = findBestTargetTable();
      const beforeSnapshot = best ? getTableSnapshot(best.table) : currentIso;
      const arrow = getDateArrowElement(direction, currentIso);
      if (!arrow) {
        return false;
      }

      arrow.click();

      const changed = await (async () => {
        const started = Date.now();
        while (Date.now() - started < DATE_WAIT_TIMEOUT_MS) {
          await sleep(PAGE_WAIT_INTERVAL_MS);
          const latest = extractSelectedDate();
          if (latest && latest !== currentIso) {
            return true;
          }
          const checkBest = findBestTargetTable();
          if (checkBest && getTableSnapshot(checkBest.table) !== beforeSnapshot) {
            return true;
          }
        }
        return false;
      })();

      if (!changed) {
        return false;
      }

      currentIso = extractSelectedDate();
      if (!currentIso) {
        return false;
      }
      if (currentIso === targetIso) {
        return true;
      }

      const remain = diffDays(currentIso, targetIso);
      if (remain === null) {
        return false;
      }
      const mustBe = remain > 0 ? "next" : "prev";
      if (mustBe !== direction) {
        return false;
      }
    }

    return extractSelectedDate() === targetIso;
  }

  async function moveToDate(targetIso) {
    const parsed = parseIsoDate(targetIso);
    if (!parsed) {
      throw new Error(`유효하지 않은 날짜입니다: ${targetIso}`);
    }

    const current = extractSelectedDate();
    if (!current) {
      throw new Error("현재 화면 기준 날짜를 찾지 못했습니다.");
    }
    if (current === targetIso) {
      return { moved: false, method: "already" };
    }

    const byInput = await setDateByInput(targetIso);
    if (byInput) {
      return { moved: true, method: "input" };
    }

    const byArrow = await moveDateByArrows(targetIso);
    if (byArrow) {
      return { moved: true, method: "arrow" };
    }

    throw new Error(`${targetIso} 날짜로 이동하지 못했습니다.`);
  }

  async function moveToFirstPageIfNeeded() {
    let movedToFirstPage = false;
    let initialPage = null;

    for (let hop = 0; hop < MAX_PAGE_HOPS; hop += 1) {
      const best = findBestTargetTable();
      if (!best) {
        return {
          movedToFirstPage,
          initialPage,
          currentPage: null,
          reason: "table-missing"
        };
      }

      const pagination = findPaginationInfo(best.table);
      const currentPage = getCurrentPage(pagination.elements);
      if (initialPage === null && currentPage !== null) {
        initialPage = currentPage;
      }

      if (currentPage === 1) {
        return {
          movedToFirstPage,
          initialPage,
          currentPage,
          reason: "at-first-page"
        };
      }

      const beforeSnapshot = getTableSnapshot(best.table);
      const pageOne = getPageNumberElement(pagination.elements, 1, true);
      const clickTarget = pageOne || getPrevPaginationElement(pagination.elements, currentPage);
      if (!clickTarget) {
        return {
          movedToFirstPage,
          initialPage,
          currentPage,
          reason: "no-way-to-first"
        };
      }

      clickTarget.click();
      const moved = await waitForPageChange(beforeSnapshot, currentPage);
      if (!moved) {
        return {
          movedToFirstPage,
          initialPage,
          currentPage,
          reason: "page-not-changed"
        };
      }
      movedToFirstPage = true;
    }

    const best = findBestTargetTable();
    const currentPage = best ? getCurrentPage(findPaginationInfo(best.table).elements) : null;
    return {
      movedToFirstPage,
      initialPage,
      currentPage,
      reason: "max-hops"
    };
  }

  async function collectRowsForCurrentDate(dateIso) {
    const collected = [];
    let pageCount = 0;
    let transitionCount = 0;
    let stopReason = "no-next-page";

    for (let hop = 0; hop < MAX_PAGE_HOPS; hop += 1) {
      const best = findBestTargetTable();
      if (!best) {
        stopReason = "table-missing";
        break;
      }

      const pageRows = best.rows.map((row) => ({
        ...row,
        date: dateIso
      }));
      collected.push(...pageRows);
      pageCount += 1;

      const pagination = findPaginationInfo(best.table);
      const currentPage = getCurrentPage(pagination.elements);
      const nextElement = getNextPaginationElement(pagination.elements, currentPage);
      if (!nextElement) {
        stopReason = "last-page";
        break;
      }

      const beforeSnapshot = getTableSnapshot(best.table);
      nextElement.click();

      const moved = await waitForPageChange(beforeSnapshot, currentPage);
      if (!moved) {
        stopReason = "page-not-changed";
        break;
      }
      transitionCount += 1;
    }

    return {
      rows: collected,
      metadata: {
        pageCount,
        transitionCount,
        stopReason
      }
    };
  }

  async function waitForBestTargetTable(timeoutMs = TABLE_WAIT_TIMEOUT_MS) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = findBestTargetTable();
      if (found) {
        return found;
      }
      await sleep(PAGE_WAIT_INTERVAL_MS);
    }
    return null;
  }

  /*
   * Main extraction entry.
   * options.rangeEnabled=false: extract current visible date only.
   * options.rangeEnabled=true: iterate startDate..endDate (max 14 days).
   */
  async function extractRankTableRows(options = {}) {
    const first = await waitForBestTargetTable();
    if (!first) {
      throw new Error(
        "순위/제목/조회수/타입/작성일 헤더를 가진 테이블을 찾지 못했습니다."
      );
    }

    const initialSelectedDate = extractSelectedDate();
    if (!initialSelectedDate) {
      throw new Error("상단 기준 날짜를 찾지 못했습니다.");
    }

    const rangeEnabled = Boolean(options.rangeEnabled);
    const rangeDates = rangeEnabled
      ? enumerateDateRange(options.startDate, options.endDate, MAX_RANGE_DAYS)
      : [initialSelectedDate];

    const allRows = [];
    let totalPageCount = 0;
    let totalTransitionCount = 0;
    let overallStopReason = "last-page";
    const dayStats = [];
    let moveMethod = "already";

    for (const targetDate of rangeDates) {
      const moved = await moveToDate(targetDate);
      moveMethod = moved.method || moveMethod;

      const currentDate = extractSelectedDate();
      if (!currentDate) {
        throw new Error("날짜 이동 후 기준 날짜를 읽지 못했습니다.");
      }
      if (currentDate !== targetDate) {
        throw new Error(`요청 날짜(${targetDate})와 화면 날짜(${currentDate})가 다릅니다.`);
      }

      const resetInfo = await moveToFirstPageIfNeeded();
      if (
        resetInfo.initialPage !== null &&
        resetInfo.initialPage > 1 &&
        resetInfo.currentPage !== 1
      ) {
        throw new Error("1페이지로 이동하지 못했습니다. 페이지를 새로고침 후 다시 시도해 주세요.");
      }

      const extracted = await collectRowsForCurrentDate(currentDate);
      totalPageCount += extracted.metadata.pageCount;
      totalTransitionCount += extracted.metadata.transitionCount;
      overallStopReason = extracted.metadata.stopReason;

      if (!extracted.rows.length) {
        dayStats.push({
          date: currentDate,
          rowCount: 0,
          pageCount: extracted.metadata.pageCount,
          stopReason: extracted.metadata.stopReason
        });
        continue;
      }

      allRows.push(...extracted.rows);
      dayStats.push({
        date: currentDate,
        rowCount: extracted.rows.length,
        pageCount: extracted.metadata.pageCount,
        stopReason: extracted.metadata.stopReason
      });
    }

    const uniqueRows = dedupeRows(allRows);
    if (!uniqueRows.length) {
      throw new Error("추출된 데이터가 없습니다.");
    }

    return {
      rows: uniqueRows,
      metadata: {
        selectedDate: rangeEnabled ? "" : initialSelectedDate,
        rangeEnabled,
        rangeStart: rangeDates[0],
        rangeEnd: rangeDates[rangeDates.length - 1],
        daysRequested: rangeDates.length,
        daysExtracted: dayStats.filter((x) => x.rowCount > 0).length,
        dayStats,
        moveMethod,
        frameUrl: window.location.href,
        rowCount: uniqueRows.length,
        rawRowCount: allRows.length,
        duplicateRowFiltered: allRows.length - uniqueRows.length,
        pageCount: totalPageCount || 1,
        transitionCount: totalTransitionCount,
        stopReason: overallStopReason,
        headers: first.headers,
        columnMap: first.columnMap
      }
    };
  }

  // Popup message endpoint.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "EXTRACT_RANK_TABLE") {
      return false;
    }

    (async () => {
      try {
        const result = await extractRankTableRows(message.options || {});
        sendResponse({ ok: true, ...result });
      } catch (error) {
        const text = error && error.message ? error.message : String(error);
        sendResponse({ ok: false, error: text });
      }
    })();

    return true;
  });
})();
