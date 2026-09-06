/**
 * VERRAA — Google Sheets Bridge (Google Apps Script)
 * =================================================
 * This script is the secure layer between the VERRAA app and Google Sheets.
 * It needs NO OAuth client, NO API keys and NO service accounts: when a coach
 * opens the link flow, Google's built-in Apps Script consent screen asks for
 * permission, and from then on the script runs *as that coach* — so it can
 * only ever touch sheets that coach can access.
 *
 * ONE-TIME SETUP (done by whoever installs VERRAA, not by each coach):
 *  1. Open https://script.google.com → New project → paste this file.
 *  2. Deploy → New deployment → type "Web app":
 *       - Execute as:     Me
 *       - Who has access: Anyone
 *     (Google will ask YOU to authorise the script once — that is normal.)
 *  3. Copy the Web App URL (ends in /exec) and paste it once into
 *     VERRAA → Settings → Google Sheets Database → "One-time app setup".
 *
 * After that, every coach links their own Google account with a single click.
 */

var SCHEMA = {
  Coaches: ['id', 'name', 'email', 'created_at', 'updated_at'],
  Clients: ['id', 'coach_id', 'created_at', 'updated_at', 'name', 'phone', 'email', 'gender', 'age', 'goal', 'status', 'join_date', 'notes', 'photo', 'follow_up_days', 'last_follow_up', 'coach_notes', 'nutrition_targets'],
  Subscriptions: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'plan_name', 'start_date', 'end_date', 'price', 'status'],
  Payments: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'subscription_id', 'amount', 'payment_date', 'payment_method', 'status', 'notes'],
  Sessions: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'date', 'time', 'type', 'status', 'notes'],
  CheckIns: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'date', 'ts', 'weight', 'waist', 'mood', 'water', 'workout_completed', 'notes', 'photo'],
  Measurements: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'date', 'weight', 'body_fat', 'waist', 'chest', 'arm', 'thigh', 'hips', 'notes'],
  ProgressPhotos: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'date', 'photo', 'notes'],
  WorkoutPlans: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'day', 'exercise_id', 'sets', 'reps', 'rest', 'notes'],
  WorkoutExercises: ['id', 'coach_id', 'created_at', 'updated_at', 'workout_id', 'exercise_id', 'sets', 'reps', 'rest', 'order'],
  Exercises: ['id', 'coach_id', 'created_at', 'updated_at', 'name', 'category', 'description', 'video_url', 'image'],
  NutritionPlans: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'name', 'start_date', 'end_date', 'notes'],
  Meals: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'type', 'description', 'calories', 'protein', 'carbs', 'fats'],
  FollowUps: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'date', 'channel', 'message', 'status'],
  Notifications: ['id', 'coach_id', 'created_at', 'updated_at', 'client_id', 'title', 'body', 'read'],
  Settings: ['coach_id', 'key', 'value', 'updated_at']
};

var TABS_USED = ['Clients', 'Exercises', 'WorkoutPlans', 'CheckIns', 'Meals', 'Subscriptions', 'Payments', 'Sessions'];

/* ------------------------------ entry points ----------------------------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.op === 'link') return linkPage(p);

    if (p.action === 'ping') return json({ ok: true, pong: true });

    var ss = openTarget(p.spreadsheet);
    if (p.action === 'init') return json({ ok: true, sheets: initTabs(ss) });
    if (p.action === 'load') return json({ ok: true,  loadTabs(ss, requireCoach(p.coach)) });
    return json({ ok: false, error: 'Unknown action: ' + p.action });
  } catch (err) {
    return json({ ok: false, error: message(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'apply') return json({ ok: false, error: 'Unknown action' });
    var ss = openTarget(body.spreadsheet);
    applyOps(ss, requireCoach(body.coach), body.ops || []);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: message(err) });
  }
}

/* --------------------------- interactive linking ------------------------- */
/* Coach clicks "Link with Google" → Google shows its built-in consent →     */
/* this runs as the coach, creates/opens the database sheet, initialises the */
/* tabs, then redirects the popup back to the app with the result.           */

function linkPage(p) {
  var returnTo = String(p.returnTo || '');
  var nonce = String(p.nonce || '');
  var payload;
  try {
    var ss;
    if (String(p.mode) === 'existing' && p.sheet) {
      var id = extractId(String(p.sheet));
      if (!id) throw new Error('That does not look like a Google Sheet URL.');
      ss = SpreadsheetApp.openById(id); // only works if the coach has access
      initTabs(ss);
      payload = { ok: true, spreadsheetId: ss.getId(), sheetUrl: ss.getUrl(), title: ss.getName() };
    } else {
      ss = SpreadsheetApp.create('VERRAA — Gym Database');
      initTabs(ss);
      payload = { ok: true, spreadsheetId: ss.getId(), sheetUrl: ss.getUrl(), title: ss.getName() };
    }
  } catch (err) {
    payload = { ok: false, error: message(err) };
  }
  payload.nonce = nonce;

  if (!returnTo) return json(payload); // direct visit — show raw result

  var encoded = encodeURIComponent(JSON.stringify(payload));
  var target = returnTo + '#verraa-link=' + encoded;
  var ok = !!payload.ok;
  var html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>VERRAA — Google Sheets</title>' +
    '<style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0b100d;color:#e4ede6;font-family:Arial,Helvetica,sans-serif;text-align:center}' +
    '.box{max-width:340px;padding:32px 24px}' +
    '.mark{width:56px;height:56px;margin:0 auto 18px;border-radius:14px;background:#cdf14b;color:#0b100d;' +
    'font-size:30px;font-weight:800;line-height:56px}' +
    'h1{font-size:20px;margin:0 0 8px}' +
    'p{font-size:13px;line-height:1.6;color:#93a89a;margin:0}' +
    '.err{color:#f58a7e}' +
    '</style></head><body><div class="box">' +
    '<div class="mark">F</div>' +
    '<h1>' + (ok ? 'Google Sheet linked' : 'Linking failed') + '</h1>' +
    '<p class="' + (ok ? '' : 'err') + '">' +
    (ok
      ? 'Your database <strong style="color:#dcf770">' + escapeHtml(payload.title) + '</strong> is ready. ' +
        'This window will close and VERRAA will continue automatically.'
      : escapeHtml(payload.error)) +
    '</p></div>' +
    '<script>setTimeout(function(){ location.replace(' + JSON.stringify(target) + '); }, ' + (ok ? 600 : 2500) + ');<\/script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('VERRAA — Google Sheets');
}

/* ------------------------------ spreadsheet ------------------------------ */

function openTarget(spreadsheetId) {
  var id = String(spreadsheetId || '');
  if (!id) throw new Error('Missing spreadsheet id — link the sheet again from Settings.');
  return SpreadsheetApp.openById(id);
}

function initTabs(ss) {
  var names = Object.keys(SCHEMA);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var cols = SCHEMA[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, cols.length).setValues([cols]);
      sh.setFrozenRows(1);
    } else {
      var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), cols.length)).getValues()[0];
      for (var c = 0; c < cols.length; c++) {
        if (!headers[c]) sh.getRange(1, c + 1).setValue(cols[c]);
      }
    }
  }
  return names;
}

function loadTabs(ss, coach) {
  var result = {};
  for (var i = 0; i < TABS_USED.length; i++) {
    result[TABS_USED[i]] = readSheet(ss, TABS_USED[i], coach);
  }
  return result;
}

function readSheet(ss, name, coach) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var coachIdx = headers.indexOf('coach_id');
  var idIdx = headers.indexOf('id');
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (coachIdx >= 0 && String(values[r][coachIdx]) !== coach) continue;
    if (idIdx >= 0 && String(values[r][idIdx] || '') === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = values[r][c];
    }
    rows.push(obj);
  }
  return rows;
}

/* --------------------------------- writes -------------------------------- */

function applyOps(ss, coach, ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.type === 'upsert') upsertRow(ss, coach, op.sheet, op.row || {});
      else if (op.type === 'remove') removeById(ss, coach, op.sheet, op.id);
      else if (op.type === 'removeWhere') removeWhere(ss, coach, op.sheet, op.field, op.value);
    }
  } finally {
    lock.releaseLock();
  }
}

function sheetAndIndex(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Tab not found: ' + name + ' — press "Link with Google" again to re-initialise.');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = {};
  for (var c = 0; c < headers.length; c++) if (headers[c]) idx[headers[c]] = c;
  return { sh: sh, idx: idx, headers: headers };
}

function upsertRow(ss, coach, name, row) {
  var ref = sheetAndIndex(ss, name);
  var sh = ref.sh;
  var idCol = ref.idx['id'];
  if (idCol === undefined) throw new Error('Tab "' + name + '" has no id column');

  var now = new Date().toISOString();
  var target = findRowById(sh, idCol, String(row.id));

  if (target >= 0) {
    writeRow(sh, ref, target, row, coach);
    if (ref.idx['updated_at'] !== undefined) sh.getRange(target, ref.idx['updated_at'] + 1).setValue(now);
  } else {
    var r = sh.getLastRow() + 1;
    writeRow(sh, ref, r, row, coach);
    if (ref.idx['created_at'] !== undefined) sh.getRange(r, ref.idx['created_at'] + 1).setValue(now);
    if (ref.idx['updated_at'] !== undefined) sh.getRange(r, ref.idx['updated_at'] + 1).setValue(now);
  }
}

function writeRow(sh, ref, rowNumber, row, coach) {
  var keys = Object.keys(row);
  for (var k = 0; k < keys.length; k++) {
    var col = ref.idx[keys[k]];
    if (col !== undefined) sh.getRange(rowNumber, col + 1).setValue(row[keys[k]]);
  }
  if (ref.idx['coach_id'] !== undefined) sh.getRange(rowNumber, ref.idx['coach_id'] + 1).setValue(coach);
  if (ref.idx['id'] !== undefined) sh.getRange(rowNumber, ref.idx['id'] + 1).setValue(String(row.id));
}

function findRowById(sh, idCol, id) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return -1;
}

function removeById(ss, coach, name, id) {
  var ref = sheetAndIndex(ss, name);
  var idCol = ref.idx['id'];
  if (idCol === undefined) return;
  var target = findRowById(ref.sh, idCol, String(id));
  if (target >= 0 && rowBelongsTo(ref.sh, ref, target, coach)) ref.sh.deleteRow(target);
}

function removeWhere(ss, coach, name, field, value) {
  var ref = sheetAndIndex(ss, name);
  var fieldCol = ref.idx[field];
  if (fieldCol === undefined) return;
  var lastRow = ref.sh.getLastRow();
  if (lastRow < 2) return;
  var values = ref.sh.getRange(2, 1, lastRow - 1, ref.headers.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var match = String(values[i][fieldCol]) === String(value);
    var own = ref.idx['coach_id'] === undefined || String(values[i][ref.idx['coach_id']]) === coach;
    if (match && own) ref.sh.deleteRow(i + 2);
  }
}

function rowBelongsTo(sh, ref, rowNumber, coach) {
  var coachCol = ref.idx['coach_id'];
  if (coachCol === undefined) return true;
  return String(sh.getRange(rowNumber, coachCol + 1).getValue()) === String(coach);
}

/* -------------------------------- helpers -------------------------------- */

function requireCoach(coach) {
  if (!coach) throw new Error('Missing coach id');
  return String(coach);
}

function extractId(input) {
  var m = String(input).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(String(input).trim())) return String(input).trim();
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function message(err) {
  return err && err.message ? err.message : String(err);
}
