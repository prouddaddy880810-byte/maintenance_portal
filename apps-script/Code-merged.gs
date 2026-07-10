// ============================================================
// CB MAINTENANCE PORTAL — Google Apps Script Backend (v2)
// COMPLETE FILE — replaces your entire Code.gs.
// ⚠️ ALSO DELETE the separate "state-sync" script file if you
//    added one — everything from it is merged in here, and
//    duplicate function names will break the project.
// Then: Deploy → Manage deployments → ✏️ → New version → Deploy
// ============================================================

const SHEET_ID = "11vQxZuilF8sJ7IA9R75vYkEdhHgZBX0xjIsJo9ywkB8"; // Your existing sheet

// ── Tab names ────────────────────────────────────────────────
const TABS = {
  WORK_ORDERS:  "Work Orders",
  GAUGE_LOGS:   "Gauge Logs",
  ASSETS:       "Assets",
  DAILY_LOG:    "Daily Log",
  PM_RECORDS:   "PM Records",
  STATE:        "State",          // NEW — cloud state for multi-device sync
};

// ── Column headers per tab ───────────────────────────────────
const HEADERS = {
  WORK_ORDERS: [
    "ID","Asset ID","Asset Name","Date","Tech","Note",
    "Priority","Status","Category","Photo URL","Created At"
  ],
  GAUGE_LOGS: [
    "ID","Asset ID","Asset Name","Timestamp","Pressure (psi)",
    "Temp (°F)","Run Hours","Load Hours","Maintenance In (hrs)",
    "Status","Key Mode","Notes","Source","Photo URL"
  ],
  ASSETS: [
    "ID","Name","Location","Category","Detail",
    "Interval Days","PM Enabled","Hidden"
  ],
  DAILY_LOG: [
    "ID","Date","Tech","Category","Entry","Photo URL","Created At"
  ],
  PM_RECORDS: [
    "ID","Asset ID","Asset Name","Date","Tech",
    "Tasks Completed","Total Tasks","Notes","Photo URL","Created At"
  ],
  STATE: [
    "key","updatedAt","json_chunk_1"
  ],
};

// ============================================================
// SETUP — Run once to create all tabs + headers
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  Object.entries(TABS).forEach(([key, tabName]) => {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    // Write headers if row 1 is empty
    if (!sheet.getRange(1, 1).getValue()) {
      const headers = HEADERS[key];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Style the header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground("#1e1b4b")
        .setFontColor("#ffffff")
        .setFontWeight("bold")
        .setFontSize(11);

      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 60);   // ID
      sheet.setColumnWidth(2, 80);   // Asset ID
      sheet.setColumnWidth(3, 180);  // Name/Text
      sheet.setColumnWidth(4, 120);  // Date
      sheet.setColumnWidth(5, 60);   // Tech
    }
  });

  Logger.log("✅ All tabs created and headers set.");
}

// ============================================================
// HTTP ROUTER — handles all POST requests from the app
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, data } = payload;

    let result;
    switch (action) {
      case "logWorkOrder":   result = appendWorkOrder(data);    break;
      case "logGauge":       result = appendGaugeLog(data);     break;
      case "syncAssets":     result = syncAssets(data);         break;
      case "logDaily":       result = appendDailyLog(data);     break;
      case "logPM":          result = appendPMRecord(data);     break;
      case "getAll":         result = getAllData();             break;
      case "saveState":      result = handleSaveState_(data);   break;  // NEW
      case "uploadPhoto":    result = handleUploadPhoto_(data); break;  // NEW
      default:
        result = { success: false, error: "Unknown action: " + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET — health check + state hydration
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "getState") {          // NEW
    return ContentService
      .createTextOutput(JSON.stringify(handleGetState_()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "CB Maintenance Portal API is live ✅" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// APPEND FUNCTIONS
// ============================================================

function appendWorkOrder(d) {
  const sheet = getSheet(TABS.WORK_ORDERS);
  sheet.appendRow([
    d.id, d.assetId, d.assetName || "", d.date, d.tech || "CB",
    d.note, d.priority || "", d.status || "",
    d.category || "", d.photoUrl || "", new Date().toISOString()
  ]);
  return { success: true, action: "logWorkOrder" };
}

function appendGaugeLog(d) {
  const sheet = getSheet(TABS.GAUGE_LOGS);
  sheet.appendRow([
    d.id, d.assetId, d.assetName || "", d.timestamp,
    d.pressure || "", d.temp || "", d.runHours || "",
    d.loadHours || "", d.maintenanceIn || "",
    d.status || "", d.keyMode || "", d.notes || "",
    d.source || "manual", d.photoUrl || ""
  ]);
  return { success: true, action: "logGauge" };
}

function appendDailyLog(d) {
  const sheet = getSheet(TABS.DAILY_LOG);
  sheet.appendRow([
    d.id, d.date, d.tech || "CB", d.category || "",
    d.entry, d.photoUrl || "", new Date().toISOString()
  ]);
  return { success: true, action: "logDaily" };
}

function appendPMRecord(d) {
  const sheet = getSheet(TABS.PM_RECORDS);
  sheet.appendRow([
    d.id, d.assetId, d.assetName || "", d.date, d.tech || "CB",
    d.tasksCompleted || 0, d.totalTasks || 0,
    d.note || "", d.photoUrl || "", new Date().toISOString()
  ]);
  return { success: true, action: "logPM" };
}

// Full asset sync — clears and rewrites the Assets tab
function syncAssets(assets) {
  const sheet = getSheet(TABS.ASSETS);
  // Keep header, clear data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  assets.forEach(a => {
    sheet.appendRow([
      a.id, a.name, a.location, a.category, a.detail,
      a.intervalDays || "", a.pmEnabled ? "YES" : "NO",
      a.hidden ? "YES" : "NO"
    ]);
  });
  return { success: true, action: "syncAssets", count: assets.length };
}

// ============================================================
// READ ALL DATA — returns everything for app hydration
// ============================================================
function getAllData() {
  return {
    success: true,
    workOrders: readSheet(TABS.WORK_ORDERS),
    gaugeLogs:  readSheet(TABS.GAUGE_LOGS),
    assets:     readSheet(TABS.ASSETS),
    dailyLogs:  readSheet(TABS.DAILY_LOG),
    pmRecords:  readSheet(TABS.PM_RECORDS),
  };
}

// ============================================================
// CLOUD STATE SYNC (NEW) — Sheet is the source of truth
// ------------------------------------------------------------
// One "State" tab. Col A = collection key (assets, logs, ...),
// Col B = updatedAt (ms), Cols C+ = JSON split into 40k chunks
// (Sheets caps cells at 50k chars). Stale-write guard rejects
// writes older than what's stored, so a laggy device can't
// roll back newer data. LockService serializes writes.
// ============================================================

const CHUNK_SIZE = 40000;

function getStateSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(TABS.STATE);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.STATE);
    sheet.appendRow(HEADERS.STATE);
  }
  return sheet;
}

// GET ?action=getState → { success, state: { assets:[...], logs:[...] } }
function handleGetState_() {
  const sheet = getStateSheet_();
  const rows = sheet.getDataRange().getValues();
  const state = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    if (!key) continue;
    let jsonStr = "";
    for (let c = 2; c < rows[i].length; c++) {
      if (rows[i][c] !== "" && rows[i][c] != null) jsonStr += String(rows[i][c]);
    }
    try { state[key] = JSON.parse(jsonStr); } catch (err) { /* skip corrupt row */ }
  }
  return { success: true, state: state };
}

// POST { action:"saveState", data:{ key, value, updatedAt } }
function handleSaveState_(data) {
  if (!data || !data.key) return { success: false, error: "missing key" };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // serialize concurrent writes from multiple devices
  try {
    const sheet = getStateSheet_();
    const rows = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.key) { rowIndex = i + 1; break; }
    }

    const incomingTs = Number(data.updatedAt) || Date.now();

    // Stale-write guard
    if (rowIndex > -1) {
      const storedTs = Number(rows[rowIndex - 1][1]) || 0;
      if (incomingTs < storedTs) {
        return { success: false, error: "stale write rejected", storedTs: storedTs };
      }
    }

    const jsonStr = JSON.stringify(data.value);
    const chunks = [];
    for (let p = 0; p < jsonStr.length; p += CHUNK_SIZE) {
      chunks.push(jsonStr.substring(p, p + CHUNK_SIZE));
    }

    const row = [data.key, incomingTs].concat(chunks);
    if (rowIndex === -1) rowIndex = sheet.getLastRow() + 1;

    // Clear the whole row first so shrinking data doesn't leave orphan chunks
    sheet.getRange(rowIndex, 1, 1, sheet.getMaxColumns()).clearContent();
    if (row.length > sheet.getMaxColumns()) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), row.length - sheet.getMaxColumns());
    }
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    return { success: true, key: data.key, updatedAt: incomingTs, chunks: chunks.length };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// PHOTO UPLOAD → DRIVE (NEW)
// ------------------------------------------------------------
// POST { action:"uploadPhoto", data:{ base64, mimeType, name } }
// Saves into a "Maintenance Portal Photos" Drive folder and
// returns an embeddable URL that works in <img> on any device.
// First run will trigger a Drive authorization prompt — normal.
// ============================================================

const PHOTO_FOLDER_NAME = "Maintenance Portal Photos";

function getPhotoFolder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function handleUploadPhoto_(data) {
  if (!data || !data.base64) return { success: false, error: "missing base64" };
  try {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.base64),
      data.mimeType || "image/jpeg",
      (data.name || "photo_" + Date.now()) + ".jpg"
    );
    const file = getPhotoFolder_().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // thumbnail endpoint renders reliably inside <img> tags (uc?export=view does not)
    const url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
    return { success: true, url: url, fileId: file.getId() };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================================
// HELPERS
// ============================================================

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Tab not found: " + name + " — run setupSheets() first");
  return sheet;
}

function readSheet(name) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}
