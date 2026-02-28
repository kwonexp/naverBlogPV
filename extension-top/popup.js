const extractBtn = document.getElementById("extractBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const periodDaysSelect = document.getElementById("periodDays");
const statusEl = document.getElementById("status");
const previewBody = document.getElementById("previewBody");

const PREVIEW_LIMIT = 10;
const TOP_ALLOWED_PERIODS = new Set([7, 14]);

let aggregatedRows = [];

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (kind) {
    statusEl.classList.add(kind);
  }
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

function buildCsv(rows) {
  const header = ["기간", "순위", "제목", "합계조회수", "타입", "작성일"];
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

function buildTsv(rows) {
  const header = ["기간", "순위", "제목", "합계조회수", "타입", "작성일"];
  const lines = rows.map((row) =>
    [row.date, row.rank, row.title, row.views, row.type, row.createdAt]
      .map((value) => String(value ?? "").replace(/\t/g, " ").replace(/\n/g, " "))
      .join("\t")
  );
  return [header.join("\t"), ...lines].join("\n");
}

function renderPreview(rows) {
  previewBody.innerHTML = "";
  const limited = rows.slice(0, PREVIEW_LIMIT);

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

function getExtractOptions() {
  const periodDays = Number(String(periodDaysSelect.value || "").trim());
  if (!TOP_ALLOWED_PERIODS.has(periodDays)) {
    throw new Error("집계 기간은 최근 7일 또는 14일만 가능합니다.");
  }

  const range = getRecentRange(periodDays);
  return {
    periodDays,
    startDate: range.startDate,
    endDate: range.endDate,
    request: {
      rangeEnabled: true,
      startDate: range.startDate,
      endDate: range.endDate
    }
  };
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

  extractBtn.disabled = true;
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  periodDaysSelect.disabled = true;

  setStatus(
    `집계 시작 (최근 ${options.periodDays}일: ${options.startDate} ~ ${options.endDate})`,
    "ok"
  );

  try {
    const tab = await getActiveTab();

    let response = null;
    try {
      const probe = await extractFromBestFrame(tab.id, { rangeEnabled: false });
      const focused = await sendExtractMessage(tab.id, probe.frameId, options.request);
      if (focused && focused.ok) {
        response = focused;
      }
    } catch (_error) {
      // Fallback to a full frame scan below.
    }

    if (!response) {
      const full = await extractFromBestFrame(tab.id, options.request);
      response = full.response;
    }

    const rawRows = response.rows || [];
    if (!rawRows.length) {
      throw new Error("추출된 데이터가 없습니다.");
    }

    const periodText = `${options.startDate} ~ ${options.endDate}`;
    const rows = buildAggregatedRows(rawRows, periodText);
    if (!rows.length) {
      throw new Error("집계 결과가 없습니다.");
    }

    aggregatedRows = rows;
    renderPreview(aggregatedRows);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

    setStatus(
      `최근 ${options.periodDays}일 집계 완료 (원본 ${rawRows.length}행 -> 글 ${rows.length}개). Preview는 Top 10만 표시합니다.`,
      "ok"
    );
  } catch (error) {
    const text = error && error.message ? error.message : String(error);
    setStatus(`실패: ${text}`, "error");
  } finally {
    extractBtn.disabled = false;
    periodDaysSelect.disabled = false;
  }
}

async function downloadCsv() {
  if (!aggregatedRows.length) {
    return;
  }

  try {
    const csv = buildCsv(aggregatedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const filename = `naver_rank_top_pv_${new Date().toISOString().slice(0, 10)}.csv`;

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
  if (!aggregatedRows.length) {
    return;
  }

  const tsv = buildTsv(aggregatedRows);

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
