const extractBtn = document.getElementById("extractBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const rangeEnabledInput = document.getElementById("rangeEnabled");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const statusEl = document.getElementById("status");
const previewBody = document.getElementById("previewBody");

let extractedRows = [];

// Popup-level status text renderer.
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
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
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

// Output builders for spreadsheet-friendly export.
function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows) {
  const header = ["날짜", "순위", "제목", "조회수", "타입", "작성일"];
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
  const header = ["날짜", "순위", "제목", "조회수", "타입", "작성일"];
  const lines = rows.map((row) =>
    [row.date, row.rank, row.title, row.views, row.type, row.createdAt]
      .map((value) => String(value ?? "").replace(/\t/g, " ").replace(/\n/g, " "))
      .join("\t")
  );
  return [header.join("\t"), ...lines].join("\n");
}

function renderPreview(rows) {
  previewBody.innerHTML = "";
  const limited = rows.slice(0, 20);
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

// Query active tab/frames to find the frame that returns valid extraction rows.
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
    const aCount = Number((a.response.metadata || {}).rowCount || 0);
    const bCount = Number((b.response.metadata || {}).rowCount || 0);
    if (bCount !== aCount) {
      return bCount - aCount;
    }
    return Number(a.frameId) - Number(b.frameId);
  });
  return okItems[0];
}

async function extractFromBestFrame(tabId, options) {
  const frames = await getFrameList(tabId);
  const messages = await Promise.all(
    frames.map(async (frame) => {
      const response = await sendExtractMessage(tabId, frame.frameId, options);
      return {
        frameId: frame.frameId,
        frameUrl: frame.url || "",
        response
      };
    })
  );

  const best = pickBestResult(messages);
  if (best) {
    return best;
  }

  const errors = messages
    .map((item) => item && item.response && item.response.error)
    .filter(Boolean);
  const detail = errors.length ? errors[0] : "추출 가능한 테이블을 찾지 못했습니다.";
  throw new Error(detail);
}

// Range option is optional; default mode extracts current on-screen date only.
function setRangeInputState(enabled) {
  startDateInput.disabled = !enabled;
  endDateInput.disabled = !enabled;
}

function getExtractOptions() {
  const rangeEnabled = Boolean(rangeEnabledInput.checked);
  if (!rangeEnabled) {
    return { rangeEnabled: false };
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
  if (days > 7) {
    throw new Error("기간 추출은 최대 7일까지 가능합니다.");
  }

  return {
    rangeEnabled: true,
    startDate,
    endDate
  };
}

// Main popup action: validate options -> extract -> preview -> enable outputs.
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
  rangeEnabledInput.disabled = true;
  startDateInput.disabled = true;
  endDateInput.disabled = true;

  if (options.rangeEnabled) {
    setStatus(
      `기간 추출 시작 (${options.startDate} ~ ${options.endDate}, 최대 7일 정책)`,
      "ok"
    );
  } else {
    setStatus("현재 화면 기준 추출 시작", "ok");
  }

  try {
    const tab = await getActiveTab();
    const result = await extractFromBestFrame(tab.id, options);
    const response = result.response;
    const rows = response.rows || [];

    if (!rows.length) {
      throw new Error("추출된 데이터가 없습니다.");
    }

    extractedRows = rows;
    renderPreview(extractedRows);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

    const meta = response.metadata || {};
    const periodText =
      meta.rangeEnabled && meta.rangeStart && meta.rangeEnd
        ? `${meta.rangeStart} ~ ${meta.rangeEnd}`
        : `기준일 ${meta.selectedDate || "-"}`;
    setStatus(
      `총 ${rows.length}행 추출 완료 (${periodText}, 페이지 ${meta.pageCount || 1}개). PREVIEW는 상위 20개 행만 보여줍니다. Download CSV 또는 Copy로 전체 결과를 확인하세요.`,
      "ok"
    );
  } catch (error) {
    const text = error && error.message ? error.message : String(error);
    setStatus(`실패: ${text}`, "error");
  } finally {
    extractBtn.disabled = false;
    rangeEnabledInput.disabled = false;
    setRangeInputState(Boolean(rangeEnabledInput.checked));
  }
}

// CSV download action.
async function downloadCsv() {
  if (!extractedRows.length) {
    return;
  }

  try {
    const csv = buildCsv(extractedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const filename = `naver_rank_pv_${new Date().toISOString().slice(0, 10)}.csv`;

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

// Clipboard copy action (TSV first-class, execCommand fallback).
async function copyRows() {
  if (!extractedRows.length) {
    return;
  }

  const tsv = buildTsv(extractedRows);

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

const today = toLocalIsoDate(new Date());
startDateInput.value = today;
endDateInput.value = today;
setRangeInputState(false);
rangeEnabledInput.addEventListener("change", () => {
  setRangeInputState(Boolean(rangeEnabledInput.checked));
});
