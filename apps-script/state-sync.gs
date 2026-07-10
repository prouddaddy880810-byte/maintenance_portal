/**
 * CLOUD STATE SYNC — makes the Sheet the source of truth across devices.
 *
 * HOW TO INSTALL (one time):
 * 1. Open your existing Apps Script project (the one deployed at your /exec URL)
 * 2. Add this file's contents as a new script file (File > New > Script: "state-sync")
 * 3. In your existing doPost(e) switch/if-chain, add:
 *        if (action === "saveState") return handleSaveState_(payload.data);
 * 4. Add (or merge into) a doGet(e):
 *        function doGet(e) {
 *          if (e.parameter.action === "getState") return handleGetState_();
 *          return json_({ success: false, error: "unknown action" });
 *        }
 * 5. Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy
 *    ⚠️ Must create a NEW VERSION or the changes won't go live.
 *    ⚠️ Keep "Who has access: Anyone" so the app can reach it.
 *
 * Storage design:
 * - One "State" tab. Column A = collection key (assets, logs, ...),
 *   Column B = updatedAt (ms), Columns C+ = JSON split into 40k-char chunks
 *   (Sheets caps cells at 50k chars).
 * - Stale-write guard: an incoming saveState with an older updatedAt than
 *   what's stored is rejected, so a laggy device can't roll back newer data.
 */

var STATE_SHEET_NAME = "State";
var CHUNK_SIZE = 40000;

function getStateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STATE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STATE_SHEET_NAME);
    sheet.appendRow(["key", "updatedAt", "json_chunk_1"]);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET ?action=getState → { success, state: { assets: [...], logs: [...] } } */
function handleGetState_() {
  var sheet = getStateSheet_();
  var rows = sheet.getDataRange().getValues();
  var state = {};
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0];
    if (!key) continue;
    var jsonStr = "";
    for (var c = 2; c < rows[i].length; c++) {
      if (rows[i][c] !== "" && rows[i][c] != null) jsonStr += String(rows[i][c]);
    }
    try { state[key] = JSON.parse(jsonStr); } catch (err) { /* skip corrupt row */ }
  }
  return json_({ success: true, state: state });
}

/** POST { action:"saveState", data:{ key, value, updatedAt } } */
function handleSaveState_(data) {
  if (!data || !data.key) return json_({ success: false, error: "missing key" });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // serialize concurrent writes from multiple devices
  try {
    var sheet = getStateSheet_();
    var rows = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.key) { rowIndex = i + 1; break; }
    }

    var incomingTs = Number(data.updatedAt) || Date.now();

    // Stale-write guard
    if (rowIndex > -1) {
      var storedTs = Number(rows[rowIndex - 1][1]) || 0;
      if (incomingTs < storedTs) {
        return json_({ success: false, error: "stale write rejected", storedTs: storedTs });
      }
    }

    var jsonStr = JSON.stringify(data.value);
    var chunks = [];
    for (var p = 0; p < jsonStr.length; p += CHUNK_SIZE) {
      chunks.push(jsonStr.substring(p, p + CHUNK_SIZE));
    }

    var row = [data.key, incomingTs].concat(chunks);
    if (rowIndex === -1) rowIndex = sheet.getLastRow() + 1;

    // Clear the whole row first so shrinking data doesn't leave orphan chunks
    sheet.getRange(rowIndex, 1, 1, sheet.getMaxColumns()).clearContent();
    if (row.length > sheet.getMaxColumns()) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), row.length - sheet.getMaxColumns());
    }
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    return json_({ success: true, key: data.key, updatedAt: incomingTs, chunks: chunks.length });
  } finally {
    lock.releaseLock();
  }
}
