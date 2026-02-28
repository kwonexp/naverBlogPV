const extractBtn = document.getElementById("extractBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const topTabBtn = document.getElementById("topTab");
const rawTabBtn = document.getElementById("rawTab");
const modeDescriptionEl = document.getElementById("modeDescription");
const rawOptionsEl = document.getElementById("rawOptions");
const topOptionsEl = document.getElementById("topOptions");
const rangeEnabledInput = document.getElementById("rangeEnabled");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const periodDaysSelect = document.getElementById("periodDays");
const previewTitleEl = document.getElementById("previewTitle");
const dateHeaderEl = document.getElementById("dateHeader");
const viewsHeaderEl = document.getElementById("viewsHeader");
const progressWrapEl = document.getElementById("progressWrap");
const progressLabelEl = document.getElementById("progressLabel");
const progressValueEl = document.getElementById("progressValue");
const progressBarEl = document.getElementById("progressBar");
const statusEl = document.getElementById("status");
const previewBody = document.getElementById("previewBody");

const MODE_RAW = "raw";
const MODE_TOP = "top";
const RAW_MAX_RANGE_DAYS = 7;
const TOP_ALLOWED_PERIODS = new Set([7, 14]);
const PREVIEW_LIMIT_BY_MODE = {
  [MODE_RAW]: 20,
  [MODE_TOP]: 10
};

let busy = false;
let currentMode = MODE_TOP;
let outputRows = [];
let outputMode = MODE_TOP;
let progressValue = 0;
let progressTickerId = null;

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (kind) {
    statusEl.classList.add(kind);
  }
}

function stopProgressTicker() {
  if (progressTickerId !== null) {
    clearInterval(progressTickerId);
    progressTickerId = null;
  }
}

function setProgressState(kind = "") {
  progressWrapEl.classList.remove("is-error");
  if (kind === "error") {
    progressWrapEl.classList.add("is-error");
  }
}

function setProgress(value, label = "") {
  const next = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  progressValue = next;
  progressBarEl.style.width = `${next}%`;
  progressValueEl.textContent = `${next}%`;
  if (label) {
    progressLabelEl.textContent = label;
  }
}

function advanceProgress(target, label = "") {
  const next = Math.max(progressValue, Number(target) || 0);
  setProgress(next, label);
}

function startProgress(label) {
  stopProgressTicker();
  progressWrapEl.hidden = false;
  setProgressState();
  setProgress(4, label || "작업 준비 중");
}

function startProgressTicker(max = 88) {
  stopProgressTicker();
  progressTickerId = setInterval(() => {
    if (progressValue >= max) {
      return;
    }
    const step = progressValue < 35 ? 4 : progressValue < 70 ? 2 : 1;
    setProgress(Math.min(max, progressValue + step));
  }, 500);
}

function finishProgress(ok, label) {
  stopProgressTicker();
  setProgressState(ok ? "" : "error");
  setProgress(100, label || (ok ? "완료" : "실패"));
}

function clearProgress() {
  stopProgressTicker();
  progressWrapEl.hidden = true;
  setProgressState();
  setProgress(0, "준비 중");
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) {
    return null;
  }
  const [year, month, day] = iso.split("-").map(Number);
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

function dateDiffInclusive(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) {
    return null;
  }
  const ms = end.getTime() - start.getTime();
  if (ms < 0) {
    return null;
  }
  return Math.floor(ms / 86400000) + 1;
}

function getRecentRange(days) {
  const base = new Date();
  base.setDate(base.getDate() - 1);
  const endDate = toLocalIsoDate(base);
  const end = parseIsoDate(endDate);
  if (!end) {
    throw new Error("최근 기간 계산 중 날짜를 읽지 못했습니다.");
  }

  const start = new Date(end.getTime());
  start.setDate(start.getDate() - (days - 1));

  return {
    startDate: toLocalIsoDate(start),
    endDate
  };
}

function parseViewNumber(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) {
    return 0;
  }
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function formatViewNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function summarizeRowsByPost(rows) {
  const map = new Map();

  for (const row of rows) {
    const title = String(row.title || "").trim();
    const createdAt = String(row.createdAt || "").trim();
    if (!title && !createdAt) {
      continue;
    }

    const key = `${title}||${createdAt}`;
    const views = parseViewNumber(row.views);
    const type = String(row.type || "").trim();

    const existing = map.get(key);
    if (existing) {
      existing.totalViews += views;
      if (!existing.type && type) {
        existing.type = type;
      }
      continue;
    }

    map.set(key, {
      title,
      createdAt,
      type,
      totalViews: views
    });
  }

  const items = Array.from(map.values());
  items.sort((a, b) => {
    if (b.totalViews !== a.totalViews) {
      return b.totalViews - a.totalViews;
    }
    const titleCompare = a.title.localeCompare(b.title, "ko");
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return a.createdAt.localeCompare(b.createdAt, "ko");
  });
  return items;
}

function buildAggregatedRows(rawRows, periodText) {
  const summarized = summarizeRowsByPost(rawRows);
  return summarized.map((item, index) => ({
    date: periodText,
    rank: String(index + 1),
    title: item.title,
    views: formatViewNumber(item.totalViews),
    type: item.type || "",
    createdAt: item.createdAt
  }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function getHeaders(mode) {
  if (mode === MODE_TOP) {
    return ["기간", "순위", "제목", "합계조회수", "타입", "작성일"];
  }
  return ["날짜", "순위", "제목", "조회수", "타입", "작성일"];
}

function buildCsv(rows, mode) {
  const header = getHeaders(mode);
  const lines = rows.map((row) =>
    [
      csvEscape(row.date),
      csvEscape(row.rank),
      csvEscape(row.title),
      csvEscape(row.views),
      csvEscape(row.type),
      csvEscape(row.createdAt)
    ].join(",")
  );
  return `\ufeff${[header.join(","), ...lines].join("\n")}`;
}

function buildTsv(rows, mode) {
  const header = getHeaders(mode);
  const lines = rows.map((row) =>
    [row.date, row.rank, row.title, row.views, row.type, row.createdAt]
      .map((value) => String(value ?? "").replace(/\t/g, " ").replace(/\n/g, " "))
      .join("\t")
  );
  return [header.join("\t"), ...lines].join("\n");
}

function renderPreview(rows, mode) {
  previewBody.innerHTML = "";
  const previewLimit = PREVIEW_LIMIT_BY_MODE[mode] || PREVIEW_LIMIT_BY_MODE[MODE_RAW];
  const limited = rows.slice(0, previewLimit);

  for (const row of limited) {
    const tr = document.createElement("tr");
    const dateTd = document.createElement("td");
    const rankTd = document.createElement("td");
    const titleTd = document.createElement("td");
    const viewsTd = document.createElement("td");
    const typeTd = document.createElement("td");
    const createdAtTd = document.createElement("td");

    dateTd.textContent = row.date || "";
    rankTd.textContent = row.rank || "";
    titleTd.textContent = row.title || "";
    viewsTd.textContent = row.views || "";
    typeTd.textContent = row.type || "";
    createdAtTd.textContent = row.createdAt || "";

    tr.appendChild(dateTd);
    tr.appendChild(rankTd);
    tr.appendChild(titleTd);
    tr.appendChild(viewsTd);
    tr.appendChild(typeTd);
    tr.appendChild(createdAtTd);
    previewBody.appendChild(tr);
  }
}

function getCurrentMode() {
  return currentMode;
}

function syncTabState(mode) {
  const isTop = mode === MODE_TOP;
  topTabBtn.classList.toggle("active", isTop);
  rawTabBtn.classList.toggle("active", !isTop);
  topTabBtn.setAttribute("aria-pressed", isTop ? "true" : "false");
  rawTabBtn.setAttribute("aria-pressed", !isTop ? "true" : "false");
}

function syncPreviewHeader(mode) {
  if (mode === MODE_TOP) {
    modeDescriptionEl.innerHTML =
      '최근 기간(7/14일) 데이터를 모아 <strong>제목 + 작성일</strong> 기준으로 합계 집계합니다.';
    previewTitleEl.textContent = "Preview (Top 10)";
    dateHeaderEl.textContent = "기간";
    viewsHeaderEl.textContent = "합계조회수";
    return;
  }

  modeDescriptionEl.innerHTML =
    '현재 화면의 <strong>순위 / 제목 / 조회수 / 타입 / 작성일</strong> 테이블을 그대로 추출합니다.';
  previewTitleEl.textContent = "Preview (상위 20행)";
  dateHeaderEl.textContent = "날짜";
  viewsHeaderEl.textContent = "조회수";
}

function syncControlState() {
  const mode = getCurrentMode();
  const rangeEnabled = Boolean(rangeEnabledInput.checked);

  syncTabState(mode);
  syncPreviewHeader(mode);
  rawOptionsEl.hidden = mode !== MODE_RAW;
  topOptionsEl.hidden = mode !== MODE_TOP;

  topTabBtn.disabled = busy;
  rawTabBtn.disabled = busy;
  extractBtn.disabled = busy;
  rangeEnabledInput.disabled = busy || mode !== MODE_RAW;
  startDateInput.disabled = busy || mode !== MODE_RAW || !rangeEnabled;
  endDateInput.disabled = busy || mode !== MODE_RAW || !rangeEnabled;
  periodDaysSelect.disabled = busy || mode !== MODE_TOP;
}

function setBusy(nextBusy) {
  busy = Boolean(nextBusy);
  syncControlState();
}

function resetOutput(mode) {
  outputRows = [];
  outputMode = mode;
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  previewBody.innerHTML = "";
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length || !tabs[0].id) {
    throw new Error("활성 탭을 찾을 수 없습니다.");
  }
  return tabs[0];
}

async function getFrameList(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!Array.isArray(frames) || !frames.length) {
      return [{ frameId: 0, url: "" }];
    }
    return frames;
  } catch (_error) {
    return [{ frameId: 0, url: "" }];
  }
}

function framePriority(url) {
  const text = String(url || "").toLowerCase();
  if (text.includes("blog.stat.naver.com") && text.includes("/stat/rank_pv")) {
    return 0;
  }
  if (text.includes("blog.stat.naver.com")) {
    return 1;
  }
  if (text.includes("/stat/rank_pv")) {
    return 2;
  }
  return 3;
}

function isGenericTableMissingError(errorText) {
  return String(errorText || "").includes(
    "순위/제목/조회수/타입/작성일 헤더를 가진 테이블을 찾지 못했습니다."
  );
}

async function sendExtractMessage(tabId, frameId, options) {
  try {
    const response = await chrome.tabs.sendMessage(
      tabId,
      { type: "EXTRACT_RANK_TABLE", options },
      { frameId }
    );
    return response || null;
  } catch (_error) {
    return null;
  }
}

function pickBestResult(items) {
  const okItems = items.filter((item) => item && item.response && item.response.ok);
  if (!okItems.length) {
    return null;
  }

  okItems.sort((a, b) => {
    const aPriority = framePriority(a.frameUrl);
    const bPriority = framePriority(b.frameUrl);
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aCount = Number((a.response.metadata || {}).rowCount || 0);
    const bCount = Number((b.response.metadata || {}).rowCount || 0);
    if (bCount !== aCount) {
      return bCount - aCount;
    }

    return Number(a.frameId) - Number(b.frameId);
  });

  return okItems[0];
}

function pickBestError(items) {
  const errors = items
    .filter((item) => item && item.response && item.response.error)
    .map((item) => ({
      frameId: item.frameId,
      frameUrl: item.frameUrl || "",
      error: String(item.response.error || "")
    }));

  if (!errors.length) {
    return "";
  }

  errors.sort((a, b) => {
    const aPriority = framePriority(a.frameUrl);
    const bPriority = framePriority(b.frameUrl);
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aGeneric = isGenericTableMissingError(a.error) ? 1 : 0;
    const bGeneric = isGenericTableMissingError(b.error) ? 1 : 0;
    if (aGeneric !== bGeneric) {
      return aGeneric - bGeneric;
    }

    return Number(a.frameId) - Number(b.frameId);
  });

  return errors[0].error;
}

async function extractFromBestFrame(tabId, options) {
  const frames = await getFrameList(tabId);
  frames.sort((a, b) => {
    const pa = framePriority(a.url);
    const pb = framePriority(b.url);
    if (pa !== pb) {
      return pa - pb;
    }
    return Number(a.frameId) - Number(b.frameId);
  });

  const messages = await Promise.all(
    frames.map(async (frame) => ({
      frameId: frame.frameId,
      frameUrl: frame.url || "",
      response: await sendExtractMessage(tabId, frame.frameId, options)
    }))
  );

  const best = pickBestResult(messages);
  if (best) {
    return best;
  }

  const detail = pickBestError(messages) || "추출 가능한 테이블을 찾지 못했습니다.";
  throw new Error(detail);
}

function getRawExtractOptions() {
  const rangeEnabled = Boolean(rangeEnabledInput.checked);
  if (!rangeEnabled) {
    return {
      mode: MODE_RAW,
      request: { rangeEnabled: false },
      startStatus: "현재 화면 기준 추출 시작"
    };
  }

  const startDate = String(startDateInput.value || "");
  const endDate = String(endDateInput.value || "");
  if (!startDate || !endDate) {
    throw new Error("기간 추출을 사용하려면 시작일/종료일을 입력해 주세요.");
  }

  const days = dateDiffInclusive(startDate, endDate);
  if (days === null) {
    throw new Error("시작일과 종료일을 확인해 주세요.");
  }
  if (days > RAW_MAX_RANGE_DAYS) {
    throw new Error(`기간 추출은 최대 ${RAW_MAX_RANGE_DAYS}일까지 가능합니다.`);
  }

  return {
    mode: MODE_RAW,
    request: {
      rangeEnabled: true,
      startDate,
      endDate
    },
    startStatus: `기간 추출 시작 (${startDate} ~ ${endDate}, 최대 ${RAW_MAX_RANGE_DAYS}일 정책)`
  };
}

function getTopExtractOptions() {
  const periodDays = Number(String(periodDaysSelect.value || "").trim());
  if (!TOP_ALLOWED_PERIODS.has(periodDays)) {
    throw new Error("집계 기간은 최근 7일 또는 14일만 가능합니다.");
  }

  const range = getRecentRange(periodDays);
  return {
    mode: MODE_TOP,
    periodDays,
    startDate: range.startDate,
    endDate: range.endDate,
    request: {
      rangeEnabled: true,
      startDate: range.startDate,
      endDate: range.endDate
    },
    startStatus: `집계 시작 (최근 ${periodDays}일: ${range.startDate} ~ ${range.endDate})`
  };
}

function getExtractOptions() {
  const mode = getCurrentMode();
  if (mode === MODE_TOP) {
    return getTopExtractOptions();
  }
  return getRawExtractOptions();
}

function handleRawResult(response) {
  const rows = response.rows || [];
  if (!rows.length) {
    throw new Error("추출된 데이터가 없습니다.");
  }

  outputRows = rows;
  outputMode = MODE_RAW;
  renderPreview(outputRows, outputMode);
  downloadBtn.disabled = false;
  copyBtn.disabled = false;

  const meta = response.metadata || {};
  const periodText =
    meta.rangeEnabled && meta.rangeStart && meta.rangeEnd
      ? `${meta.rangeStart} ~ ${meta.rangeEnd}`
      : `기준일 ${meta.selectedDate || "-"}`;
  setStatus(
    `총 ${rows.length}행 추출 완료 (${periodText}, 페이지 ${meta.pageCount || 1}개). Preview는 상위 20행만 표시합니다.`,
    "ok"
  );
}

function handleTopResult(response, options) {
  const rawRows = response.rows || [];
  if (!rawRows.length) {
    throw new Error("추출된 데이터가 없습니다.");
  }

  const periodText = `${options.startDate} ~ ${options.endDate}`;
  const rows = buildAggregatedRows(rawRows, periodText);
  if (!rows.length) {
    throw new Error("집계 결과가 없습니다.");
  }

  outputRows = rows;
  outputMode = MODE_TOP;
  renderPreview(outputRows, outputMode);
  downloadBtn.disabled = false;
  copyBtn.disabled = false;

  setStatus(
    `최근 ${options.periodDays}일 집계 완료 (원본 ${rawRows.length}행 -> 글 ${rows.length}개). Preview는 Top 10만 표시합니다.`,
    "ok"
  );
}

async function extractRows() {
  const options = (() => {
    try {
      return getExtractOptions();
    } catch (error) {
      const text = error && error.message ? error.message : String(error);
      setStatus(`실패: ${text}`, "error");
      return null;
    }
  })();
  if (!options) {
    return;
  }

  setBusy(true);
  resetOutput(options.mode);
  startProgress(options.startStatus);
  setStatus(options.startStatus, "ok");

  try {
    advanceProgress(12, "활성 탭 확인 중");
    const tab = await getActiveTab();

    if (options.mode === MODE_TOP) {
      advanceProgress(24, "대상 프레임 탐색 중");
      startProgressTicker(78);
      let response = null;
      try {
        const probe = await extractFromBestFrame(tab.id, { rangeEnabled: false });
        advanceProgress(48, "집계 데이터 추출 중");
        const focused = await sendExtractMessage(tab.id, probe.frameId, options.request);
        if (focused && focused.ok) {
          response = focused;
        }
      } catch (_error) {
        // Fall through to full frame scan.
      }

      if (!response) {
        advanceProgress(62, "프레임 전체 재시도 중");
        const full = await extractFromBestFrame(tab.id, options.request);
        response = full.response;
      }

      advanceProgress(90, "집계 결과 정리 중");
      handleTopResult(response, options);
      finishProgress(true, "집계 완료");
      return;
    }

    advanceProgress(30, "원본 데이터 추출 중");
    startProgressTicker(84);
    const result = await extractFromBestFrame(tab.id, options.request);
    advanceProgress(90, "결과 정리 중");
    handleRawResult(result.response);
    finishProgress(true, "추출 완료");
  } catch (error) {
    finishProgress(false, "실패");
    const text = error && error.message ? error.message : String(error);
    setStatus(`실패: ${text}`, "error");
  } finally {
    setBusy(false);
  }
}

async function downloadCsv() {
  if (!outputRows.length) {
    return;
  }

  try {
    const csv = buildCsv(outputRows, outputMode);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const prefix = outputMode === MODE_TOP ? "naver_rank_top_pv" : "naver_rank_pv";
    const filename = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;

    await chrome.downloads.download({
      url,
      filename,
      saveAs: true
    });

    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(`${filename} 다운로드 완료`, "ok");
  } catch (error) {
    const text = error && error.message ? error.message : String(error);
    setStatus(`다운로드 실패: ${text}`, "error");
  }
}

async function copyRows() {
  if (!outputRows.length) {
    return;
  }

  const tsv = buildTsv(outputRows, outputMode);

  try {
    await navigator.clipboard.writeText(tsv);
    setStatus("클립보드에 복사 완료", "ok");
    return;
  } catch (_error) {
    // Fallback for environments where navigator.clipboard is unavailable.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = tsv;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("execCommand copy failed");
    }
    setStatus("클립보드에 복사 완료", "ok");
  } catch (error) {
    const text = error && error.message ? error.message : String(error);
    setStatus(`복사 실패: ${text}`, "error");
  }
}

extractBtn.addEventListener("click", () => {
  extractRows();
});

downloadBtn.addEventListener("click", () => {
  downloadCsv();
});

copyBtn.addEventListener("click", () => {
  copyRows();
});

function switchMode(mode) {
  if (busy || mode === currentMode) {
    return;
  }

  currentMode = mode;
  resetOutput(mode);
  clearProgress();
  syncControlState();
  if (mode === MODE_TOP) {
    setStatus("상위 글 집계 모드로 전환됨", "ok");
    return;
  }
  setStatus("원본 순위 추출 모드로 전환됨", "ok");
}

topTabBtn.addEventListener("click", () => {
  switchMode(MODE_TOP);
});

rawTabBtn.addEventListener("click", () => {
  switchMode(MODE_RAW);
});

rangeEnabledInput.addEventListener("change", () => {
  syncControlState();
});

const today = toLocalIsoDate(new Date());
startDateInput.value = today;
endDateInput.value = today;
clearProgress();
syncControlState();
