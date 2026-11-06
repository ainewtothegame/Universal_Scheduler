/**
 * build_single_file.js
 * Inlines all styles, scripts, SheetJS, and domain logic into a 100% self-contained index.html.
 * Zero external file dependencies - only index.html is needed!
 */

import fs from 'fs';

console.log('Building 100% self-contained index.html (zero external dependencies)...');

const sheetJsCode = fs.readFileSync('xlsx.full.min.js', 'utf8');

function cleanModuleCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  // Strip import statements
  code = code.replace(/^import\s[^;]*?from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '');
  // Replace export function / export const / export class / export let
  code = code.replace(/export\s+function\s+/g, 'function ');
  code = code.replace(/export\s+const\s+/g, 'const ');
  code = code.replace(/export\s+let\s+/g, 'let ');
  code = code.replace(/export\s+class\s+/g, 'class ');
  return code;
}

const domainDataCode = cleanModuleCode('src/domain_data.js');
const cspSolverCode = cleanModuleCode('src/csp_solver.js');
const conflictEngineCode = cleanModuleCode('src/conflict_engine.js');
const excelEngineCode = cleanModuleCode('src/excel_engine.js');
const storageAdapterCode = cleanModuleCode('src/storage_adapter.js');

// HTML shell
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PSP Fire Marshal On-Call Schedule Generator</title>
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-hover: #172554;
      --bg-main: #f8fafc;
      --card-bg: #ffffff;
      --border-color: #cbd5e1;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --warning: #d97706;
      --success: #16a34a;
      --info: #0284c7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Bar */
    header {
      background: var(--primary);
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 50;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .brand-badge {
      font-size: 11px;
      background: rgba(255,255,255,0.2);
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .cycle-select {
      background: #ffffff;
      color: var(--text-main);
      border: 1px solid var(--border-color);
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn:active { transform: scale(0.98); }

    .btn-light {
      background: #ffffff;
      color: var(--primary);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .btn-light:hover { background: #f1f5f9; }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    .btn-success {
      background: var(--success);
      color: #ffffff;
    }
    .btn-success:hover { background: #15803d; }

    .btn-danger {
      background: var(--danger);
      color: #ffffff;
    }
    .btn-danger:hover { background: var(--danger-hover); }

    .btn-outline {
      background: transparent;
      border-color: rgba(255,255,255,0.4);
      color: #ffffff;
    }
    .btn-outline:hover { background: rgba(255,255,255,0.1); }

    .btn-outline-dark {
      background: #ffffff;
      border-color: var(--border-color);
      color: var(--text-main);
    }
    .btn-outline-dark:hover { background: #f1f5f9; }

    /* Action Ribbon */
    .ribbon {
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .tab-group {
      display: flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 2px;
    }

    .tab-btn {
      padding: 6px 14px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .tab-btn.active {
      background: #ffffff;
      color: var(--primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .ribbon-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Month Navigation Tabs */
    .month-tabs {
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      padding: 0 24px;
      display: flex;
      overflow-x: auto;
      gap: 4px;
    }

    .month-tab {
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
    }

    .month-tab:hover { color: var(--text-main); }
    .month-tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 24px;
      max-width: 1440px;
      margin: 0 auto;
      width: 100%;
    }

    /* Calendar Grid */
    .calendar-container {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .calendar-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }

    .calendar-title {
      font-size: 18px;
      font-weight: 700;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      border-bottom: 1px solid var(--border-color);
    }

    .dow-header {
      padding: 10px;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      background: #f1f5f9;
      color: var(--text-muted);
      border-right: 1px solid var(--border-color);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .dow-header:last-child { border-right: none; }

    .day-cell {
      min-height: 110px;
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 8px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      position: relative;
      cursor: pointer;
      transition: background 0.1s;
    }

    .day-cell:hover { background: #f8fafc; }
    .day-cell:nth-child(7n) { border-right: none; }

    .day-cell.other-month {
      background: #fbfcfe;
      opacity: 0.45;
    }

    .day-cell.weekend-col {
      background: #fafbfe;
    }

    .day-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .day-num {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
    }

    .holiday-pill {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      line-height: 1.25;
      text-align: right;
      max-width: 100px;
    }
    .holiday-pill.premium { background: #fee2e2; color: #b91c1c; }
    .holiday-pill.standard { background: #e0e7ff; color: #3730a3; }

    .assignment-chip {
      margin-top: auto;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .unassigned-chip {
      background: #f1f5f9;
      color: var(--danger);
      border: 1px dashed var(--danger);
      box-shadow: none;
      font-size: 11px;
    }

    .conflict-badges {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 3px;
    }

    .conflict-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-error { background: var(--danger); }
    .dot-warning { background: var(--warning); }
    .dot-attention { background: var(--info); }

    .calendar-footer {
      padding: 12px 20px;
      font-size: 12px;
      color: var(--text-muted);
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Modals & Dialogs */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.65);
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }

    .modal {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
      max-width: 650px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.15s ease-out;
    }

    .modal-wide { max-width: 800px; }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 16px 20px;
      background: var(--primary);
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title { font-size: 16px; font-weight: 700; }
    .modal-close {
      background: none; border: none; color: #ffffff; font-size: 22px; cursor: pointer;
      line-height: 1; padding: 0 4px;
    }
    .modal-close:hover { opacity: 0.8; }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      font-size: 13px;
    }

    .modal-footer {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .form-group {
      margin-bottom: 14px;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 4px;
    }
    .form-input, .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(30,58,138,0.15);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .item-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .color-picker-row {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .color-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .color-swatch.selected {
      border-color: #0f172a;
      transform: scale(1.1);
    }

    /* Matrix Table */
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .matrix-table th, .matrix-table td {
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      text-align: left;
    }
    .matrix-table th { background: #f1f5f9; font-weight: 700; }

    /* Alert Banner */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
      z-index: 200;
      display: none;
      align-items: center;
      gap: 10px;
    }

    #print-all-container { display: none; }
    .breakdown-table { width:100%; border-collapse:collapse; font-size:13px; }
    .breakdown-table th, .breakdown-table td { border:1px solid var(--border-color); padding:8px 10px; text-align:center; }
    .breakdown-table th { background:#f1f5f9; font-weight:700; }
    .breakdown-table td:first-child, .breakdown-table th:first-child { text-align:left; }
    .breakdown-table tr.totals td { background:#f8fafc; font-weight:700; }
    .bd-bar { display:inline-block; height:10px; border-radius:3px; vertical-align:middle; margin-right:6px; }

    /* Print Stylesheet */
    @media print {
      header, .ribbon, .month-tabs, .btn, .modal-overlay {
        display: none !important;
      }
      body { background: #ffffff !important; }
      main { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
      .calendar-container {
        border: none !important;
        box-shadow: none !important;
        break-after: page;
        page-break-after: always;
      }
      .day-cell { min-height: 90px !important; border: 1px solid #000000 !important; }
      .assignment-chip {
        color: #000000 !important;
        background: transparent !important;
        border: 1px solid #000000 !important;
        font-weight: 700 !important;
      }
      body.printing-all #view-calendar-wrapper,
      body.printing-all #view-matrix-wrapper,
      body.printing-all #view-breakdown-wrapper { display: none !important; }
      body.printing-all #print-all-container { display: block !important; }
      @page { size: landscape; margin: 0.5in; }
    }
  </style>
</head>
<body>

  <!-- Top Navigation Bar -->
  <header>
    <div class="brand">
      <div class="brand-title">Pennsylvania State Police</div>
      <div class="brand-badge">Fire Marshal On-Call Scheduler</div>
    </div>
    <div class="header-controls">
      <label style="font-size:12px; font-weight:600; opacity:0.9;">Cycle:</label>
      <select id="cycle-select" class="cycle-select"></select>
      <button id="btn-open-add-cycle" class="btn btn-outline" title="Add New Year or Schedule Block">+ Add Year / Block</button>
      <button id="btn-undo" class="btn btn-outline" title="Undo (Ctrl+Z)">&#8630; Undo</button>
      <button id="btn-redo" class="btn btn-outline" title="Redo (Ctrl+Y)">&#8631; Redo</button>
      <button id="btn-solve" class="btn btn-light">&#9881; Auto-Generate Schedule</button>
    </div>
  </header>

  <!-- Action Ribbon -->
  <div class="ribbon">
    <div class="tab-group">
      <button id="tab-calendar-view" class="tab-btn active">7-Column Calendar</button>
      <button id="tab-matrix-view" class="tab-btn">Matrix Overview</button>
      <button id="tab-breakdown-view" class="tab-btn">Shift Breakdown</button>
    </div>
    <div class="ribbon-actions">
      <button id="btn-open-roster" class="btn btn-outline-dark">&#128101; Personnel Roster (<span id="roster-count">7</span>)</button>
      <button id="btn-open-blackouts" class="btn btn-outline-dark">&#128197; Blackouts & Leave (<span id="blackout-count">0</span>)</button>
      <button id="btn-open-prefs" class="btn btn-outline-dark">&#11088; Requested Weekends (<span id="pref-count">0</span>)</button>
      <button id="btn-open-import" class="btn btn-outline-dark">&#128196; Import Schedule</button>
      <button id="btn-export-excel" class="btn btn-primary">&#128229; Export to Excel</button>
      <button id="btn-backup-export" class="btn btn-outline-dark" title="Download all data (roster, blackouts, requests, schedules) as a JSON backup file">&#128190; Export Backup (JSON)</button>
      <button id="btn-backup-restore" class="btn btn-outline-dark" title="Restore everything from a JSON backup file">&#128194; Restore Backup</button>
      <input type="file" id="backup-file-input" accept=".json,application/json" style="display:none;">
      <button id="btn-print" class="btn btn-outline-dark">&#128424; Print</button>
      <button id="btn-print-all" class="btn btn-outline-dark" title="Print every month of the active cycle in one go">&#128424; Print All Months</button>
    </div>
  </div>

  <!-- Month Navigation Tabs (For Calendar View) -->
  <div id="month-tabs-bar" class="month-tabs"></div>

  <!-- Main Content Area -->
  <main id="main-content">
    <div id="view-calendar-wrapper">
      <div class="calendar-container">
        <div class="calendar-header">
          <div id="calendar-month-title" class="calendar-title">January 2027</div>
          <div style="font-size: 13px; color: var(--text-muted);" id="calendar-summary-stat"></div>
        </div>
        <div class="calendar-grid">
          <div class="dow-header">Monday</div>
          <div class="dow-header">Tuesday</div>
          <div class="dow-header">Wednesday</div>
          <div class="dow-header">Thursday</div>
          <div class="dow-header">Friday</div>
          <div class="dow-header">Saturday</div>
          <div class="dow-header">Sunday</div>
        </div>
        <div id="calendar-days-grid" class="calendar-grid"></div>
        <div class="calendar-footer">
          <div><strong>Rule Note:</strong> On call starts PM that day (after scheduled shift) through 0600hrs the next morning. Click any date cell to manually adjust shift assignment.</div>
          <div id="exemption-note" style="color:var(--danger); font-weight:600; display:none;">* Administrative Exemption: Manual Alternate Weekday Assignment</div>
        </div>
      </div>
    </div>

    <!-- Shift Breakdown View (Hidden by default) -->
    <div id="view-breakdown-wrapper" style="display:none;">
      <div class="calendar-container" style="padding:20px;">
        <h2 style="font-size:18px; margin-bottom:4px;">Shift Breakdown</h2>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Number of on-call shifts (days) per team member for the active cycle. Use this to check how evenly shifts are distributed.</div>
        <div id="breakdown-table-container"></div>
      </div>
    </div>

    <!-- Print All container (only visible when printing all months) -->
    <div id="print-all-container"></div>

    <!-- Matrix View (Hidden by default) -->
    <div id="view-matrix-wrapper" style="display:none;">
      <div class="calendar-container" style="padding:20px;">
        <h2 style="font-size:18px; margin-bottom:16px;">Cycle Shift Matrix & Weekend Rest Overview</h2>
        <div id="matrix-table-container"></div>
      </div>
    </div>
  </main>

  <!-- Modal Backdrop Overlay -->
  <div id="modal-overlay" class="modal-overlay">

    <!-- 1. Personnel Roster Modal -->
    <div id="modal-roster" class="modal modal-wide" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">&#128101; Personnel Roster Manager</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Add Member Form -->
        <div style="background:#f1f5f9; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div id="member-form-title" style="font-weight:700; font-size:14px; margin-bottom:12px; color:var(--primary);">+ Add Investigator to Roster</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Investigator Last Name *</label>
              <input type="text" id="member-name-input" class="form-input" placeholder="e.g. SMITH">
            </div>
            <div class="form-group">
              <label class="form-label">Role Classification *</label>
              <select id="member-role-input" class="form-select">
                <option value="FT">Full-Time Fire Marshal (FT)</option>
                <option value="ALT">Alternate Fire Marshal (ALT)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Baseline Preferred Weekday</label>
              <select id="member-weekday-input" class="form-select">
                <option value="">None / Alternate Rotational</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Badge Color</label>
              <input type="color" id="member-color-input" class="form-input" value="#1e3a8a" style="height:38px; padding:2px;">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Active Start Date</label>
              <input type="date" id="member-start-input" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Active End Date (Optional)</label>
              <input type="date" id="member-end-input" class="form-input" placeholder="Leave blank if indefinite">
            </div>
          </div>
          <div class="form-group" id="member-prefday-group" style="display:none;">
            <label class="form-label">Preferred Day If Available (rotational members only)</label>
            <select id="member-prefday-input" class="form-select">
              <option value="">No preference (pure rotation)</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
            </select>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Used only when it keeps shift counts fair and rest/blackout rules allow it.</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="btn-save-new-member" class="btn btn-primary" style="flex:1; justify-content:center; padding:9px;">+ Add Investigator to Active Roster</button>
            <button id="btn-cancel-edit" class="btn btn-outline-dark" style="display:none; padding:9px;">Cancel Edit</button>
          </div>
        </div>

        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Active Roster (<span id="modal-roster-count">0</span> Members)</div>
        <div id="roster-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 2. Blackouts & Vacations Modal -->
    <div id="modal-blackouts" class="modal modal-wide" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">&#128197; Vacations & Blackouts Booking</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#f1f5f9; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:var(--primary);">+ Book New Leave / Blackout Range</div>
          <div class="form-group">
            <label class="form-label">Investigator *</label>
            <select id="book-member-select" class="form-select"></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date *</label>
              <input type="date" id="book-start-input" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">End Date *</label>
              <input type="date" id="book-end-input" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Leave Notes / Reason</label>
            <input type="text" id="book-notes-input" class="form-input" placeholder="e.g. Summer Vacation, Hunting, Training, Military Leave">
          </div>
          <button id="btn-save-new-blackout" class="btn btn-primary" style="width:100%; justify-content:center; padding:9px;">Book Blackout Range</button>
        </div>

        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Approved Blackouts (<span id="modal-blackouts-count">0</span>)</div>
        <div id="blackouts-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 3. Add Year / Schedule Block Modal -->
    <div id="modal-prefs" class="modal modal-wide" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">&#11088; Requested Weekends (Want to Work)</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px; color:var(--text-muted);">
          Weekends listed here are locked in for that person when you click Auto-Generate. All other weekends are scheduled around them.
          A request is skipped only if it is impossible (blackout, same weekend requested by two people, or back-to-back weekends for one person), and you will be told which.
        </p>
        <div style="background:#f1f5f9; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div class="form-group">
            <label class="form-label">Investigator *</label>
            <select id="pref-member-select" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Weekend (current schedule block) *</label>
            <select id="pref-weekend-select" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <input type="text" id="pref-notes-input" class="form-input" placeholder="e.g. Swapped with Terek">
          </div>
          <button id="btn-save-new-pref" class="btn btn-primary" style="width:100%; justify-content:center; padding:9px;">Add Requested Weekend</button>
        </div>
        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Requests for this block (<span id="modal-pref-count">0</span>)</div>
        <div id="pref-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 3b. Add Year / Schedule Block Modal -->
    <div id="modal-add-cycle" class="modal" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">&#128197; Add Year / Schedule Block</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px; color:var(--text-muted);">
          Create a new on-call schedule block for any future year (e.g. 2028, 2029). Pennsylvania State Police official holidays will be calculated automatically.
        </p>
        <div class="form-group">
          <label class="form-label">Calendar Year *</label>
          <input type="number" id="new-cycle-year" class="form-input" value="2028" min="2025" max="2050">
        </div>
        <div class="form-group">
          <label class="form-label">Schedule Block Type *</label>
          <select id="new-cycle-block" class="form-select">
            <option value="FULL">Full Calendar Year (Jan 1 – Dec 31)</option>
            <option value="H1">First Half / H1 (Jan 1 – Jun 30)</option>
            <option value="H2">Second Half / H2 (Jul 1 – Dec 31)</option>
          </select>
        </div>
        <div style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid var(--border-color); margin-bottom:14px;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="new-cycle-carry-roster" checked>
            Carry forward current active personnel roster
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-confirm-add-cycle" class="btn btn-primary">Create Schedule Block</button>
      </div>
    </div>

    <!-- 4. Reassign Shift Modal -->
    <div id="modal-reassign" class="modal" style="width:400px; display:none;">
      <div class="modal-header">
        <div id="reassign-date-title" class="modal-title">Reassign Shift</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Assign Duty Investigator</label>
          <select id="reassign-member-select" class="form-select"></select>
        </div>
        <div id="reassign-conflict-preview" style="padding:10px; border-radius:6px; background:#f8fafc; font-size:12px; min-height:40px;">
          Select an investigator to evaluate fatigue rest rules.
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-clear-shift" class="btn btn-danger" style="margin-right:auto;">Clear Shift</button>
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-save-shift" class="btn btn-primary">Save Assignment</button>
      </div>
    </div>

    <!-- 5. Import Modal -->
    <div id="modal-import" class="modal modal-wide" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">&#128196; Import Barracks Schedule</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="border: 2px dashed var(--border-color); border-radius:10px; padding:30px 20px; text-align:center; background:#f8fafc; cursor:pointer;" id="drop-zone">
          <div style="font-size:36px; margin-bottom:8px;">&#128194;</div>
          <div style="font-weight:700; font-size:15px; margin-bottom:4px;">Drag & Drop Excel (.xlsx) or CSV Schedule</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Supports standard 7-Column Barracks Calendars and 2-Column Date Lists</div>
          <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none;">
          <button type="button" class="btn btn-primary" onclick="document.getElementById('file-input').click()">Browse Computer Files</button>
        </div>
        <div id="import-preview-box" style="margin-top:16px; display:none;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
      </div>
    </div>

    <!-- 6. Unmatched Alias Reconcile Modal -->
    <div id="modal-alias" class="modal modal-wide" style="display:none;">
      <div class="modal-header">
        <div class="modal-title">Reconcile Imported Personnel Names</div>
        <button class="modal-close" onclick="closeAllModals()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px; color:var(--text-muted);">
          The imported schedule contains names not matched in your active roster. Map each alias to an existing investigator or create a historical record:
        </p>
        <div id="alias-mapping-list"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-confirm-alias" class="btn btn-primary">Apply Reconciled Schedule</button>
      </div>
    </div>

  </div>

  <!-- Notification Toast -->
  <div id="toast" class="toast"></div>

  <!-- Inlined SheetJS Library -->
  <script>
    ${sheetJsCode}
  </script>

  <!-- Inlined Domain & Architecture Modules -->
  <script>
    // --- domain_data.js ---
    ${domainDataCode}

    // --- csp_solver.js ---
    ${cspSolverCode}

    // --- conflict_engine.js ---
    ${conflictEngineCode}

    // --- excel_engine.js ---
    ${excelEngineCode}

    // --- storage_adapter.js ---
    ${storageAdapterCode}

    // --- Algorithmic Holiday Generator for Any Year ---
    function getNthWeekdayOfMonth(year, monthIndex, weekday, n) {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, monthIndex, d);
        if (dt.getMonth() !== monthIndex) break;
        if (dt.getDay() === weekday) {
          count++;
          if (count === n) return dt;
        }
      }
      return null;
    }

    function getLastWeekdayOfMonth(year, monthIndex, weekday) {
      let last = null;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, monthIndex, d);
        if (dt.getMonth() !== monthIndex) break;
        if (dt.getDay() === weekday) last = dt;
      }
      return last;
    }

    function getEasterSunday(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }

    function generateOfficialPSPHolidays(year) {
      const holidays = [];
      function addHol(dt, name, type) {
        if (!dt) return;
        holidays.push({ date: formatDate(dt), year, name, type });
      }

      // New Year's Day: Jan 1
      const ny = new Date(year, 0, 1);
      const nyDow = ny.getDay();
      addHol(ny, "New Year's Day", nyDow === 5 ? 'attached_fri' : (nyDow === 1 ? 'attached_mon' : (nyDow === 0 || nyDow === 6 ? 'weekend' : 'midweek')));

      // Martin Luther King Day: 3rd Monday in Jan
      addHol(getNthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Day", 'attached_mon');

      // Presidents' Day: 3rd Monday in Feb
      addHol(getNthWeekdayOfMonth(year, 1, 1, 3), "Presidents' Day", 'attached_mon');

      // Good Friday: 2 days before Easter Sunday
      const easter = getEasterSunday(year);
      const goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
      addHol(goodFriday, 'Good Friday', 'attached_fri');

      // Memorial Day: Last Monday in May
      addHol(getLastWeekdayOfMonth(year, 4, 1), 'Memorial Day', 'attached_mon');

      // Juneteenth: June 19
      const june19 = new Date(year, 5, 19);
      const jDow = june19.getDay();
      addHol(june19, 'Juneteenth', jDow === 5 ? 'attached_fri' : (jDow === 1 ? 'attached_mon' : (jDow === 0 || jDow === 6 ? 'weekend' : 'midweek')));

      // Independence Day: July 4
      const jul4 = new Date(year, 6, 4);
      const julDow = jul4.getDay();
      addHol(jul4, 'Independence Day', julDow === 5 ? 'attached_fri' : (julDow === 1 ? 'attached_mon' : (julDow === 0 || julDow === 6 ? 'weekend' : 'midweek')));
      if (julDow === 0) {
        addHol(new Date(year, 6, 5), 'Independence Day (Observed)', 'attached_mon');
      } else if (julDow === 6) {
        addHol(new Date(year, 6, 3), 'Independence Day (Observed)', 'attached_fri');
      }

      // Labor Day: 1st Monday in Sept
      addHol(getNthWeekdayOfMonth(year, 8, 1, 1), 'Labor Day', 'attached_mon');

      // Columbus Day: 2nd Monday in Oct
      addHol(getNthWeekdayOfMonth(year, 9, 1, 2), 'Columbus Day', 'attached_mon');

      // General Election Day: Tuesday after 1st Monday in Nov
      const firstMonNov = getNthWeekdayOfMonth(year, 10, 1, 1);
      const electionDay = new Date(firstMonNov.getTime() + 24 * 60 * 60 * 1000);
      addHol(electionDay, 'General Election Day', 'midweek');

      // Veterans Day: Nov 11
      const vetDay = new Date(year, 10, 11);
      const vetDow = vetDay.getDay();
      addHol(vetDay, 'Veterans Day', vetDow === 5 ? 'attached_fri' : (vetDow === 1 ? 'attached_mon' : (vetDow === 0 || vetDow === 6 ? 'weekend' : 'midweek')));

      // Thanksgiving Day: 4th Thursday in Nov
      addHol(getNthWeekdayOfMonth(year, 10, 4, 4), 'Thanksgiving Day', 'midweek');

      // Christmas Day: Dec 25
      const xmas = new Date(year, 11, 25);
      const xDow = xmas.getDay();
      addHol(xmas, 'Christmas Day', xDow === 5 ? 'attached_fri' : (xDow === 1 ? 'attached_mon' : (xDow === 0 || xDow === 6 ? 'weekend' : 'midweek')));

      return holidays;
    }

    // --- UI Controller & Application Bootstrap ---
    const storage = new StorageAdapter();
    window.appState = storage.state;
    if (!window.appState.preferredWeekends) window.appState.preferredWeekends = [];

    let activeMonthIdx = 0; // 0=Jan
    let selectedDateForReassign = null;
    let pendingImportShifts = null;

    // Toast notification helper
    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3200);
    }

    // DOM Elements
    const cycleSelect = document.getElementById('cycle-select');
    const monthTabsBar = document.getElementById('month-tabs-bar');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const calendarSummaryStat = document.getElementById('calendar-summary-stat');
    const exemptionNote = document.getElementById('exemption-note');
    const rosterCount = document.getElementById('roster-count');
    const blackoutCount = document.getElementById('blackout-count');

    // Tab buttons
    const tabCalendarView = document.getElementById('tab-calendar-view');
    const tabMatrixView = document.getElementById('tab-matrix-view');
    const viewCalendarWrapper = document.getElementById('view-calendar-wrapper');
    const viewMatrixWrapper = document.getElementById('view-matrix-wrapper');
    const tabBreakdownView = document.getElementById('tab-breakdown-view');
    const viewBreakdownWrapper = document.getElementById('view-breakdown-wrapper');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const modalRoster = document.getElementById('modal-roster');
    const modalBlackouts = document.getElementById('modal-blackouts');
    const modalPrefs = document.getElementById('modal-prefs');
    const modalAddCycle = document.getElementById('modal-add-cycle');
    const modalReassign = document.getElementById('modal-reassign');
    const modalImport = document.getElementById('modal-import');
    const modalAlias = document.getElementById('modal-alias');

    function closeAllModals() {
      modalOverlay.classList.remove('open');
      modalRoster.style.display = 'none';
      modalBlackouts.style.display = 'none';
      modalPrefs.style.display = 'none';
      modalAddCycle.style.display = 'none';
      modalReassign.style.display = 'none';
      modalImport.style.display = 'none';
      modalAlias.style.display = 'none';
      if (typeof resetMemberForm === 'function') resetMemberForm();
    }

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeAllModals();
    });

    // Keyboard handlers:
    // 1. Esc closes the open menu/modal
    // 2. Enter in a menu accepts changes and saves
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (modalOverlay.classList.contains('open')) {
          closeAllModals();
        }
        return;
      }

      if (e.key === 'Enter') {
        if (modalOverlay.classList.contains('open')) {
          if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) {
            return;
          }
          e.preventDefault();
          if (modalRoster.style.display !== 'none') {
            document.getElementById('btn-save-new-member').click();
          } else if (modalBlackouts.style.display !== 'none') {
            document.getElementById('btn-save-new-blackout').click();
          } else if (modalPrefs.style.display !== 'none') {
            document.getElementById('btn-save-new-pref').click();
          } else if (modalAddCycle.style.display !== 'none') {
            document.getElementById('btn-confirm-add-cycle').click();
          } else if (modalReassign.style.display !== 'none') {
            document.getElementById('btn-save-shift').click();
          } else if (modalAlias.style.display !== 'none') {
            document.getElementById('btn-confirm-alias').click();
          }
        }
      }
    });

    // Helper: Determine if a member is active for a given cycle
    function isMemberInCycle(m, cycle) {
      if (!cycle) return true;
      if (m.activeEnd && cycle.startDate > m.activeEnd) return false;
      if (m.activeStart && cycle.endDate < m.activeStart) return false;
      return true;
    }

    // Helper: Get active members for the currently selected cycle
    function getCycleRoster() {
      const cycle = getActiveCycle();
      return window.appState.roster.filter(m => isMemberInCycle(m, cycle));
    }

    function getActiveCycle() {
      if (!window.appState.cycles[window.appState.activeCycleId]) {
        // Fallback to first available cycle
        const keys = Object.keys(window.appState.cycles);
        if (keys.length > 0) window.appState.activeCycleId = keys[0];
      }
      return window.appState.cycles[window.appState.activeCycleId];
    }

    // Refresh Cycle Selector Options
    function refreshCycleDropdown() {
      const cycleKeys = Object.keys(window.appState.cycles);
      cycleSelect.innerHTML = cycleKeys.map(k => {
        const c = window.appState.cycles[k];
        const label = c.blockType === 'FULL' ? \`\${c.year} Full Year\` : \`\${c.year} \${c.blockType} (\${c.startDate} to \${c.endDate})\`;
        return \`<option value="\${c.id}" \${c.id === window.appState.activeCycleId ? 'selected' : ''}>\${label}</option>\`;
      }).join('');
    }

    // Refresh UI
    function renderApp() {
      refreshCycleDropdown();
      const cycle = getActiveCycle();
      rosterCount.textContent = getCycleRoster().length;
      blackoutCount.textContent = cycleBlackouts().length;
      document.getElementById('pref-count').textContent = cyclePrefs().length;

      renderMonthTabs();
      renderCalendar();
      renderMatrix();
      renderBreakdown();
    }

    function renderMonthTabs() {
      const cycle = getActiveCycle();
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const months = [];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);

      while (curr <= last) {
        months.push({ name: monthNames[curr.getMonth()], idx: curr.getMonth(), year: curr.getFullYear() });
        curr.setMonth(curr.getMonth() + 1);
      }

      // If activeMonthIdx is outside the cycle's months, reset it
      const validIndices = months.map(m => m.idx);
      if (!validIndices.includes(activeMonthIdx)) {
        activeMonthIdx = validIndices[0];
      }

      monthTabsBar.innerHTML = months.map(m => \`
        <button class="month-tab \${m.idx === activeMonthIdx ? 'active' : ''}" data-idx="\${m.idx}">
          \${m.name} \${m.year}
        </button>
      \`).join('');

      monthTabsBar.querySelectorAll('.month-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          activeMonthIdx = parseInt(btn.getAttribute('data-idx'));
          renderApp();
        });
      });
    }

    // Render 7-Column Calendar Grid
    function renderCalendar() {
      const cycle = getActiveCycle();
      const year = cycle.year;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      calendarMonthTitle.textContent = \`\${monthNames[activeMonthIdx]} \${year}\`;

      // Evaluate Conflicts
      const conflicts = evaluateScheduleConflicts(cycle, window.appState.roster, window.appState.blackouts, window.appState.holidays, cycle.assignments);

      let hasExemption = false;

      // Find first day of month and build grid
      const firstDay = new Date(year, activeMonthIdx, 1);
      const lastDay = new Date(year, activeMonthIdx + 1, 0);

      const firstDow = firstDay.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const mondayOffset = firstDow === 0 ? -6 : (1 - firstDow);
      let weekMonday = addDays(firstDay, mondayOffset);

      let cellsHtml = '';
      let assignedCount = 0;
      let totalMonthDays = lastDay.getDate();

      while (weekMonday <= lastDay) {
        for (let i = 0; i < 7; i++) {
          const d = addDays(weekMonday, i);
          const dStr = formatDate(d);
          const isCurrentMonth = d.getMonth() === activeMonthIdx;
          const dow = d.getDay();
          const isWeekend = (dow === 0 || dow === 6);

          const assignedId = cycle.assignments[dStr];
          const member = window.appState.roster.find(m => m.id === assignedId);
          if (isCurrentMonth && assignedId) assignedCount++;

          // Check holidays
          const holiday = window.appState.holidays.find(h => h.date === dStr);

          // Check conflicts
          const dayConflicts = conflicts[dStr] || [];
          const hasError = dayConflicts.some(c => c.type === 'ERROR');
          const hasWarning = dayConflicts.some(c => c.type === 'WARNING');
          const hasAttention = dayConflicts.some(c => c.type === 'ATTENTION');

          if (dayConflicts.some(c => c.code === 'ALT_WEEKDAY_VIOLATION')) {
            hasExemption = true;
          }

          let chipHtml = '';
          if (member) {
            chipHtml = \`
              <div class="assignment-chip" style="background:\${member.color};">
                <span>\${member.name}</span>
                <span style="font-size:10px; opacity:0.85;">\${member.role}</span>
              </div>
            \`;
          } else {
            chipHtml = \`<div class="assignment-chip unassigned-chip">UNASSIGNED</div>\`;
          }

          let dotsHtml = '';
          if (hasError || hasWarning || hasAttention) {
            dotsHtml = '<div class="conflict-badges">';
            if (hasError) dotsHtml += '<div class="conflict-dot dot-error" title="Contractual Fatigue / Blackout Conflict"></div>';
            if (hasWarning) dotsHtml += '<div class="conflict-dot dot-warning" title="Warning / Quota Breach"></div>';
            if (hasAttention) dotsHtml += '<div class="conflict-dot dot-attention" title="Multi-Shift Coverage"></div>';
            dotsHtml += '</div>';
          }

          cellsHtml += \`
            <div class="day-cell \${!isCurrentMonth ? 'other-month' : ''} \${isWeekend ? 'weekend-col' : ''}" data-date="\${dStr}">
              <div class="day-top">
                <span class="day-num">\${d.getDate()}</span>
                \${holiday ? \`<span class="holiday-pill \${isPremiumHoliday(holiday) ? 'premium' : 'standard'}" title="\${holiday.name}\${isPremiumHoliday(holiday) ? ' (premium)' : ' (non-premium)'}">\${holiday.name}\${isPremiumHoliday(holiday) ? ' (premium)' : ''}</span>\` : ''}
              </div>
              \${dotsHtml}
              \${chipHtml}
            </div>
          \`;
        }
        weekMonday = addDays(weekMonday, 7);
      }

      calendarDaysGrid.innerHTML = cellsHtml;
      calendarSummaryStat.textContent = \`Staffed: \${assignedCount} / \${totalMonthDays} Days\`;
      exemptionNote.style.display = hasExemption ? 'block' : 'none';

      // Cell click handler for reassigning
      calendarDaysGrid.querySelectorAll('.day-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const dateStr = cell.getAttribute('data-date');
          openReassignModal(dateStr);
        });
      });
    }

    // Render Matrix Overview
    function renderMatrix() {
      const cycle = getActiveCycle();
      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays);
      const container = document.getElementById('matrix-table-container');

      container.innerHTML = \`
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Weekend #</th>
              <th>Weekend Dates</th>
              <th>Assigned Personnel</th>
              <th>Role</th>
              <th>Attached Holiday</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            \${weekends.map(w => {
              const workerId = cycle.assignments[w.saturday];
              const mem = window.appState.roster.find(m => m.id === workerId);
              const hol = w.attachedMonday || w.attachedFriday || '-';
              return \`
                <tr>
                  <td>Weekend \${w.index + 1}</td>
                  <td>\${w.friday} &rarr; \${w.sunday}</td>
                  <td><strong>\${mem ? mem.name : '<span style="color:var(--danger)">UNASSIGNED</span>'}</strong></td>
                  <td><span style="padding:2px 6px; border-radius:4px; font-weight:600; font-size:11px; background:\${mem?.role === 'FT' ? '#e0f2fe' : '#fef3c7'}; color:\${mem?.role === 'FT' ? '#0369a1' : '#b45309'}">\${mem?.role || '-'}</span></td>
                  <td>\${hol}</td>
                  <td>\${mem ? '<span style="color:var(--success); font-weight:600;">&#10003; Staffed</span>' : '<span style="color:var(--danger); font-weight:600;">Action Required</span>'}</td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      \`;
    }

    // Render Shift Breakdown
    function renderBreakdown() {
      const cycle = getActiveCycle();
      const container = document.getElementById('breakdown-table-container');
      const roster = getCycleRoster();
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const months = [];
      let mc = new Date(start.getFullYear(), start.getMonth(), 1);
      while (mc <= end) { months.push({ y: mc.getFullYear(), m: mc.getMonth() }); mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1); }

      const stats = {};
      roster.forEach(m => { stats[m.id] = { total: 0, weekday: 0, sat: 0, sun: 0, hol: 0, months: months.map(() => 0) }; });
      let unassigned = 0;
      let totalDays = 0;
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        totalDays++;
        const dStr = formatDate(d);
        const id = cycle.assignments[dStr];
        if (!id || !stats[id]) { unassigned++; continue; }
        const s = stats[id];
        const dow = d.getDay();
        s.total++;
        if (dow === 6) s.sat++; else if (dow === 0) s.sun++; else s.weekday++;
        if (window.appState.holidays.some(h => h.date === dStr)) s.hol++;
        const mi = months.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth());
        if (mi >= 0) s.months[mi]++;
      }

      const totals = roster.map(m => stats[m.id].total);
      const max = Math.max(0, ...totals);
      const min = totals.length ? Math.min(...totals) : 0;
      const avg = roster.length ? (totals.reduce((a, b) => a + b, 0) / roster.length) : 0;
      const spread = max - min;
      const balanced = spread <= 1;

      container.innerHTML = \`
        <div style="margin-bottom:14px; padding:10px 14px; border-radius:8px; font-size:13px; background:\${balanced ? '#dcfce7' : '#fef3c7'}; color:\${balanced ? '#166534' : '#92400e'}; font-weight:600;">
          \${balanced ? '&#10003; Shifts are evenly distributed' : '&#9888; Shifts are not evenly distributed'} &mdash; Min: \${min} | Max: \${max} | Average: \${avg.toFixed(1)} | Spread: \${spread}\${unassigned ? ' | Unassigned days: ' + unassigned : ''}
        </div>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Member</th><th>Role</th><th>Total Shifts</th><th>Weekday</th><th>Saturday</th><th>Sunday</th><th>Holiday Days</th><th>vs. Avg</th>
              \${months.map(x => \`<th>\${monthNames[x.m]}</th>\`).join('')}
            </tr>
          </thead>
          <tbody>
            \${roster.map(m => {
              const s = stats[m.id];
              const diff = s.total - avg;
              const color = Math.abs(diff) <= 1 ? 'var(--success)' : 'var(--danger)';
              const w = max ? Math.round((s.total / max) * 80) : 0;
              return \`<tr>
                <td><strong>\${m.name}</strong></td>
                <td>\${m.role}</td>
                <td style="text-align:left;"><span class="bd-bar" style="width:\${w}px; background:\${m.color};"></span><strong>\${s.total}</strong></td>
                <td>\${s.weekday}</td><td>\${s.sat}</td><td>\${s.sun}</td><td>\${s.hol}</td>
                <td style="color:\${color}; font-weight:600;">\${diff > 0 ? '+' : ''}\${diff.toFixed(1)}</td>
                \${s.months.map(n => \`<td>\${n}</td>\`).join('')}
              </tr>\`;
            }).join('')}
            <tr class="totals">
              <td>Total</td><td></td>
              <td>\${totals.reduce((a, b) => a + b, 0)}</td>
              <td>\${roster.reduce((a, m) => a + stats[m.id].weekday, 0)}</td>
              <td>\${roster.reduce((a, m) => a + stats[m.id].sat, 0)}</td>
              <td>\${roster.reduce((a, m) => a + stats[m.id].sun, 0)}</td>
              <td>\${roster.reduce((a, m) => a + stats[m.id].hol, 0)}</td>
              <td></td>
              \${months.map((x, i) => \`<td>\${roster.reduce((a, m) => a + stats[m.id].months[i], 0)}</td>\`).join('')}
            </tr>
          </tbody>
        </table>
      \`;
    }

    // Tab view switching
    function showView(which) {
      const views = [
        [tabCalendarView, viewCalendarWrapper, 'calendar'],
        [tabMatrixView, viewMatrixWrapper, 'matrix'],
        [tabBreakdownView, viewBreakdownWrapper, 'breakdown']
      ];
      views.forEach(([tab, wrap, name]) => {
        tab.classList.toggle('active', name === which);
        wrap.style.display = name === which ? 'block' : 'none';
      });
      monthTabsBar.style.display = which === 'calendar' ? 'flex' : 'none';
      if (which === 'matrix') renderMatrix();
      if (which === 'breakdown') renderBreakdown();
    }
    tabCalendarView.addEventListener('click', () => showView('calendar'));
    tabMatrixView.addEventListener('click', () => showView('matrix'));
    tabBreakdownView.addEventListener('click', () => showView('breakdown'));
    // Auto-Generate Schedule
    document.getElementById('btn-solve').addEventListener('click', () => {
      storage.pushUndo();
      const cycle = getActiveCycle();
      const result = solveSchedule(cycle, getCycleRoster(), window.appState.blackouts, window.appState.holidays, cycle.manualOverrides, window.appState.preferredWeekends);
      cycle.assignments = result.assignments;
      cycle.solverDiagnostics = result.diagnostics;
      cycle.updatedAt = Date.now();
      storage.saveState();
      renderApp();
      if (result.preferenceWarnings && result.preferenceWarnings.length) {
        alert('Schedule generated, but these requested weekends could not be honored:\\n\\n' + result.preferenceWarnings.join('\\n'));
      } else {
        showToast('Schedule successfully generated! Requested weekends honored; all fatigue, rest, and quota rules applied.');
      }
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (storage.undo()) {
        renderApp();
        showToast('Undo performed.');
      }
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      if (storage.redo()) {
        renderApp();
        showToast('Redo performed.');
      }
    });

    // Cycle Change
    cycleSelect.addEventListener('change', (e) => {
      window.appState.activeCycleId = e.target.value;
      storage.saveState();
      const c = getActiveCycle();
      const start = parseDate(c.startDate);
      activeMonthIdx = start.getMonth();
      renderApp();
    });

    // -------------------------------------------------------------
    // 1. Roster Manager Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-roster').addEventListener('click', () => {
      openRosterModal();
    });

    function openRosterModal() {
      const cycle = getActiveCycle();
      resetMemberForm();
      renderRosterList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalRoster.style.display = 'flex';
    }

    function renderRosterList() {
      const list = document.getElementById('roster-items-container');
      const cycle = getActiveCycle();
      const cycleRoster = getCycleRoster();
      const endedMembers = window.appState.roster.filter(m => !isMemberInCycle(m, cycle));

      document.getElementById('modal-roster-count').textContent = cycleRoster.length;
      document.getElementById('roster-count').textContent = cycleRoster.length;

      const weekdayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };

      let html = '';
      if (cycleRoster.length === 0) {
        html += '<div style="color:var(--text-muted); padding:16px; text-align:center;">No active investigators for this schedule block.</div>';
      } else {
        html += cycleRoster.map(m => \`
          <div class="item-card">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="width:16px; height:16px; border-radius:50%; background:\${m.color}; display:inline-block; flex-shrink:0;"></span>
              <div>
                <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                  \${m.name}
                  <span style="font-size:11px; padding:2px 8px; border-radius:4px; font-weight:700; background:\${m.role === 'FT' ? '#e0f2fe' : '#fef3c7'}; color:\${m.role === 'FT' ? '#0369a1' : '#b45309'}">\${m.role === 'FT' ? 'Full-Time (FT)' : 'Alternate (ALT)'}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                  Active: \${m.activeStart} \${m.activeEnd ? ('to ' + m.activeEnd) : '(Indefinite)'}
                  \${m.baselineWeekday ? (' &bull; Baseline: ' + weekdayNames[m.baselineWeekday]) : (m.role === 'FT' ? ' &bull; Rotational' : '')}
                  \${(!m.baselineWeekday && m.preferredWeekday) ? (' (prefers ' + weekdayNames[m.preferredWeekday] + ' if available)') : ''}
                </div>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline-dark btn-edit-member" data-id="\${m.id}" style="color:var(--primary); border-color:var(--primary); padding:4px 10px; font-size:12px;">Edit</button>
              <button class="btn btn-outline-dark btn-remove-member" data-id="\${m.id}" style="color:var(--danger); border-color:#fca5a5; padding:4px 10px; font-size:12px;">Remove</button>
            </div>
          </div>
        \`).join('');
      }

      if (endedMembers.length > 0) {
        html += \`
          <div style="margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-color);">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:600;">
              Ended / Past Members for this block (\${endedMembers.length} removed from active menu):
            </div>
            \${endedMembers.map(m => \`
              <div class="item-card" style="opacity:0.75; background:#f8fafc; border:1px dashed var(--border-color);">
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--text-muted);">\${m.name} (\${m.role})</div>
                  <div style="font-size:11px; color:var(--danger);">End Date: \${m.activeEnd} (before block start \${cycle.startDate})</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-outline-dark btn-edit-member" data-id="\${m.id}" style="font-size:11px; padding:3px 8px;">Edit End Date</button>
                  <button class="btn btn-outline-dark btn-remove-member" data-id="\${m.id}" style="color:var(--danger); border-color:#fca5a5; font-size:11px; padding:3px 8px;">Remove</button>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      }

      list.innerHTML = html;

      list.querySelectorAll('.btn-edit-member').forEach(btn => {
        btn.addEventListener('click', () => startEditMember(btn.getAttribute('data-id')));
      });

      list.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const mem = window.appState.roster.find(m => m.id === id);
          if (confirm(\`Remove \${mem ? mem.name : 'this investigator'} from the roster?\`)) {
            window.appState.roster = window.appState.roster.filter(m => m.id !== id);
            storage.saveState();
            renderRosterList();
            renderApp();
            showToast('Investigator removed from roster.');
          }
        });
      });
    }

    // ---- Edit support ----
    let editingMemberId = null;

    function syncPrefDayVisibility() {
      const rotational = !document.getElementById('member-weekday-input').value;
      document.getElementById('member-prefday-group').style.display = rotational ? 'block' : 'none';
      if (!rotational) document.getElementById('member-prefday-input').value = '';
    }
    document.getElementById('member-weekday-input').addEventListener('change', syncPrefDayVisibility);

    function resetMemberForm() {
      editingMemberId = null;
      document.getElementById('member-name-input').value = '';
      document.getElementById('member-role-input').value = 'FT';
      document.getElementById('member-weekday-input').value = '';
      document.getElementById('member-prefday-input').value = '';
      document.getElementById('member-color-input').value = '#1e3a8a';
      document.getElementById('member-start-input').value = getActiveCycle().startDate;
      document.getElementById('member-end-input').value = '';
      document.getElementById('member-form-title').textContent = '+ Add Investigator to Roster';
      document.getElementById('btn-save-new-member').textContent = '+ Add Investigator to Active Roster';
      document.getElementById('btn-cancel-edit').style.display = 'none';
      syncPrefDayVisibility();
    }

    function startEditMember(id) {
      const m = window.appState.roster.find(x => x.id === id);
      if (!m) return;
      editingMemberId = id;
      document.getElementById('member-name-input').value = m.name;
      document.getElementById('member-role-input').value = m.role;
      document.getElementById('member-weekday-input').value = m.baselineWeekday ? String(m.baselineWeekday) : '';
      syncPrefDayVisibility();
      document.getElementById('member-prefday-input').value = m.preferredWeekday ? String(m.preferredWeekday) : '';
      document.getElementById('member-color-input').value = m.color || '#1e3a8a';
      document.getElementById('member-start-input').value = m.activeStart || '';
      document.getElementById('member-end-input').value = m.activeEnd || '';
      document.getElementById('member-form-title').textContent = 'Editing ' + m.name;
      document.getElementById('btn-save-new-member').textContent = 'Save Changes';
      document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
      document.getElementById('member-name-input').focus();
    }

    document.getElementById('btn-cancel-edit').addEventListener('click', resetMemberForm);

    document.getElementById('btn-save-new-member').addEventListener('click', () => {
      const nameInput = document.getElementById('member-name-input');
      const name = nameInput.value.trim().toUpperCase();
      if (!name) {
        alert('Please enter the investigator\\'s last name.');
        return;
      }

      const role = document.getElementById('member-role-input').value;
      const weekdayVal = document.getElementById('member-weekday-input').value;
      const baselineWeekday = weekdayVal ? parseInt(weekdayVal) : null;
      const color = document.getElementById('member-color-input').value;
      const activeStart = document.getElementById('member-start-input').value || '2027-01-01';
      const activeEnd = document.getElementById('member-end-input').value || null;

      const prefVal = document.getElementById('member-prefday-input').value;
      const preferredWeekday = (!baselineWeekday && prefVal) ? parseInt(prefVal) : null;

      if (activeEnd && activeEnd < activeStart) {
        alert('Active end date must be on or after the start date.');
        return;
      }

      if (editingMemberId) {
        const m = window.appState.roster.find(x => x.id === editingMemberId);
        if (m) {
          Object.assign(m, { name, role, activeStart, activeEnd, baselineWeekday, preferredWeekday, color });
        }
        storage.saveState();
        resetMemberForm();
        renderRosterList();
        renderApp();
        showToast(name + ' updated. Re-run Auto-Generate to apply changes.');
        return;
      }

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);

      window.appState.roster.push({
        preferredWeekday,
        id,
        name,
        role,
        activeStart,
        activeEnd,
        baselineWeekday,
        color
      });

      storage.saveState();
      nameInput.value = '';
      document.getElementById('member-end-input').value = '';
      renderRosterList();
      renderApp();
      showToast(\`\${name} added to roster successfully.\`);
    });

    // -------------------------------------------------------------
    // 2. Blackouts & Leave Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-blackouts').addEventListener('click', () => {
      openBlackoutsModal();
    });

    // Helper: Get blackouts for the currently selected cycle
    // In H1/H2, show only blackouts overlapping that portion; in FULL, show all
    function cycleBlackouts() {
      const c = getActiveCycle();
      if (!c || c.blockType === 'FULL') {
        return window.appState.blackouts;
      }
      return window.appState.blackouts.filter(b => b.startDate <= c.endDate && b.endDate >= c.startDate);
    }

    function openBlackoutsModal() {
      const select = document.getElementById('book-member-select');
      const cycleRoster = getCycleRoster();
      select.innerHTML = cycleRoster.map(m => \`
        <option value="\${m.id}">\${m.name} (\${m.role})</option>
      \`).join('');

      const cycle = getActiveCycle();
      document.getElementById('book-start-input').value = cycle.startDate;
      document.getElementById('book-end-input').value = cycle.startDate;

      renderBlackoutsList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalBlackouts.style.display = 'flex';
    }

    function renderBlackoutsList() {
      const list = document.getElementById('blackouts-items-container');
      const blackouts = cycleBlackouts();
      document.getElementById('modal-blackouts-count').textContent = blackouts.length;
      document.getElementById('blackout-count').textContent = blackouts.length;

      if (blackouts.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center;">No blackout ranges booked for this schedule block.</div>';
        return;
      }

      list.innerHTML = blackouts.map(b => {
        const mem = window.appState.roster.find(m => m.id === b.memberId);
        return \`
          <div class="item-card">
            <div>
              <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px;">
                \${mem?.color ? ('<span style="width:10px; height:10px; border-radius:50%; background:' + mem.color + ';"></span>') : ''}
                \${mem?.name || b.memberId}
                <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">\${b.notes ? ('(' + b.notes + ')') : ''}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                \${b.startDate} &rarr; \${b.endDate}
              </div>
            </div>
            <button class="btn btn-outline-dark btn-delete-blackout" data-id="\${b.id}" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:11px;">Delete</button>
          </div>
        \`;
      }).join('');

      list.querySelectorAll('.btn-delete-blackout').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          window.appState.blackouts = window.appState.blackouts.filter(b => b.id !== id);
          storage.saveState();
          renderBlackoutsList();
          renderApp();
          showToast('Blackout range removed.');
        });
      });
    }

    document.getElementById('btn-save-new-blackout').addEventListener('click', () => {
      const memberId = document.getElementById('book-member-select').value;
      const startDate = document.getElementById('book-start-input').value;
      const endDate = document.getElementById('book-end-input').value;
      const notes = document.getElementById('book-notes-input').value.trim();

      if (!memberId) {
        alert('Please select an investigator.');
        return;
      }
      if (!startDate || !endDate) {
        alert('Please choose both start and end dates.');
        return;
      }
      if (startDate > endDate) {
        alert('Start date must be before or equal to end date.');
        return;
      }

      window.appState.blackouts.push({
        id: \`b_\${Date.now()}\`,
        memberId,
        startDate,
        endDate,
        notes: notes || 'Vacation / Leave'
      });

      storage.saveState();
      renderBlackoutsList();
      renderApp();
      document.getElementById('book-notes-input').value = '';
      showToast('Blackout booked successfully.');
    });

    // -------------------------------------------------------------
    // 2b. Requested Weekends Handlers
    // -------------------------------------------------------------
    // Helper: Get requested weekends for the currently selected cycle
    // In H1/H2, show only requests for that portion; in FULL, show all
    function cyclePrefs() {
      const c = getActiveCycle();
      if (!c || c.blockType === 'FULL') {
        return window.appState.preferredWeekends;
      }
      return window.appState.preferredWeekends.filter(p => p.weekendFriday >= c.startDate && p.weekendFriday <= c.endDate);
    }

    document.getElementById('btn-open-prefs').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const cycleRoster = getCycleRoster();
      document.getElementById('pref-member-select').innerHTML = cycleRoster.map(m =>
        \`<option value="\${m.id}">\${m.name} (\${m.role})</option>\`).join('');
      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays);
      document.getElementById('pref-weekend-select').innerHTML = weekends.map(w => {
        const hol = w.attachedMonday ? ' + Mon holiday' : (w.attachedFriday ? ' + Fri holiday' : '');
        return \`<option value="\${w.friday}">Fri \${w.friday} to Sun \${w.sunday}\${hol}</option>\`;
      }).join('');
      renderPrefsList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalPrefs.style.display = 'flex';
    });

    function renderPrefsList() {
      const list = document.getElementById('pref-items-container');
      const prefs = cyclePrefs().sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday));
      document.getElementById('modal-pref-count').textContent = prefs.length;
      document.getElementById('pref-count').textContent = prefs.length;
      if (prefs.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center;">No requested weekends for this block.</div>';
        return;
      }
      list.innerHTML = prefs.map(p => {
        const mem = window.appState.roster.find(m => m.id === p.memberId);
        return \`
          <div class="item-card">
            <div>
              <div style="font-weight:700; font-size:13px;">&#11088; \${mem ? mem.name : p.memberId}
                <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">\${p.notes ? ('(' + p.notes + ')') : ''}</span></div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Weekend starting Fri \${p.weekendFriday}</div>
            </div>
            <button class="btn btn-outline-dark btn-delete-pref" data-id="\${p.id}" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:11px;">Delete</button>
          </div>\`;
      }).join('');

      list.querySelectorAll('.btn-delete-pref').forEach(btn => {
        btn.addEventListener('click', () => {
          window.appState.preferredWeekends = window.appState.preferredWeekends.filter(p => p.id !== btn.getAttribute('data-id'));
          storage.saveState();
          renderPrefsList();
          renderApp();
          showToast('Requested weekend removed. Re-run Auto-Generate to apply.');
        });
      });
    }

    document.getElementById('btn-save-new-pref').addEventListener('click', () => {
      const memberId = document.getElementById('pref-member-select').value;
      const weekendFriday = document.getElementById('pref-weekend-select').value;
      const notes = document.getElementById('pref-notes-input').value.trim();
      if (!memberId || !weekendFriday) { alert('Choose an investigator and a weekend.'); return; }
      if (window.appState.preferredWeekends.some(p => p.memberId === memberId && p.weekendFriday === weekendFriday)) {
        alert('That request already exists.');
        return;
      }
      window.appState.preferredWeekends.push({ id: \`p_\${Date.now()}\`, memberId, weekendFriday, notes });
      storage.saveState();
      document.getElementById('pref-notes-input').value = '';
      renderPrefsList();
      renderApp();
      showToast('Requested weekend added. Click Auto-Generate Schedule to apply.');
    });

    // -------------------------------------------------------------
    // 3. Add Year / Schedule Block Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-add-cycle').addEventListener('click', () => {
      const currentCycle = getActiveCycle();
      document.getElementById('new-cycle-year').value = currentCycle ? (currentCycle.year + 1) : 2028;
      closeAllModals();
      modalOverlay.classList.add('open');
      modalAddCycle.style.display = 'flex';
    });

    document.getElementById('btn-confirm-add-cycle').addEventListener('click', () => {
      const year = parseInt(document.getElementById('new-cycle-year').value);
      const blockType = document.getElementById('new-cycle-block').value;
      const carryRoster = document.getElementById('new-cycle-carry-roster').checked;

      if (!year || year < 2020 || year > 2060) {
        alert('Please enter a valid 4-digit calendar year.');
        return;
      }

      const cycleId = \`\${year}-\${blockType}\`;

      if (window.appState.cycles[cycleId]) {
        if (!confirm(\`Schedule block "\${cycleId}" already exists. Overwrite it?\`)) {
          return;
        }
      }

      let startDate = \`\${year}-01-01\`;
      let endDate = \`\${year}-12-31\`;
      if (blockType === 'H1') {
        startDate = \`\${year}-01-01\`;
        endDate = \`\${year}-06-30\`;
      } else if (blockType === 'H2') {
        startDate = \`\${year}-07-01\`;
        endDate = \`\${year}-12-31\`;
      }

      // Generate holidays for the year and merge
      const generatedHols = generateOfficialPSPHolidays(year);
      const existingHolDates = new Set(window.appState.holidays.map(h => h.date));
      generatedHols.forEach(h => {
        if (!existingHolDates.has(h.date)) {
          window.appState.holidays.push(h);
        }
      });

      // Create new cycle entry
      window.appState.cycles[cycleId] = {
        id: cycleId,
        year,
        blockType,
        startDate,
        endDate,
        rosterSnapshot: carryRoster ? [...window.appState.roster] : [],
        blackoutsSnapshot: [],
        assignments: {},
        manualOverrides: {},
        solverDiagnostics: {},
        updatedAt: Date.now()
      };

      // Set as active
      window.appState.activeCycleId = cycleId;
      storage.saveState();

      activeMonthIdx = blockType === 'H2' ? 6 : 0;
      closeAllModals();
      renderApp();
      showToast(\`Schedule block "\${cycleId}" created successfully! Click "Auto-Generate Schedule" to staff.\`);
    });

    // -------------------------------------------------------------
    // 4. Shift Reassign Handlers
    // -------------------------------------------------------------
    function openReassignModal(dateStr) {
      selectedDateForReassign = dateStr;
      const cycle = getActiveCycle();
      const currentAssigned = cycle.assignments[dateStr];

      document.getElementById('reassign-date-title').textContent = \`Duty Assignment: \${dateStr}\`;
      const select = document.getElementById('reassign-member-select');
      
      const availableMembers = window.appState.roster.filter(m => {
        if (m.activeStart && dateStr < m.activeStart) return false;
        if (m.activeEnd && dateStr > m.activeEnd) return false;
        return true;
      });

      select.innerHTML = '<option value="">-- UNASSIGNED --</option>' +
        availableMembers.map(m => \`
          <option value="\${m.id}" \${m.id === currentAssigned ? 'selected' : ''}>
            \${m.name} (\${m.role})
          </option>
        \`).join('');

      function updatePreview() {
        const preview = document.getElementById('reassign-conflict-preview');
        const selectedId = select.value;
        if (!selectedId) {
          preview.innerHTML = '<span style="color:var(--text-muted)">Shift will be marked Unassigned.</span>';
          return;
        }
        const mem = window.appState.roster.find(m => m.id === selectedId);
        const dayBlackout = window.appState.blackouts.find(b => b.memberId === selectedId && dateStr >= b.startDate && dateStr <= b.endDate);
        if (dayBlackout) {
          preview.innerHTML = \`<span style="color:var(--danger); font-weight:700;">&#9888; Blackout Conflict: \${mem?.name} is on booked leave (\${dayBlackout.notes})</span>\`;
        } else if (mem?.role === 'ALT' && getDayOfWeek(dateStr) >= 1 && getDayOfWeek(dateStr) <= 4) {
          preview.innerHTML = \`<span style="color:var(--warning); font-weight:700;">&#9888; Quota Warning: Alternate assigned to mid-week shift. Will trigger administrative exemption badge.</span>\`;
        } else {
          preview.innerHTML = \`<span style="color:var(--success); font-weight:600;">&#10003; No blackout conflicts for \${mem?.name}.</span>\`;
        }
      }

      select.onchange = updatePreview;
      updatePreview();

      closeAllModals();
      modalOverlay.classList.add('open');
      modalReassign.style.display = 'flex';
    }

    document.getElementById('btn-save-shift').addEventListener('click', () => {
      if (!selectedDateForReassign) return;
      storage.pushUndo();
      const cycle = getActiveCycle();
      const newMemberId = document.getElementById('reassign-member-select').value;

      if (newMemberId) {
        cycle.assignments[selectedDateForReassign] = newMemberId;
        cycle.manualOverrides[selectedDateForReassign] = true;
      } else {
        delete cycle.assignments[selectedDateForReassign];
        delete cycle.manualOverrides[selectedDateForReassign];
      }
      cycle.updatedAt = Date.now();
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Shift for \${selectedDateForReassign} updated.\`);
    });

    document.getElementById('btn-clear-shift').addEventListener('click', () => {
      if (!selectedDateForReassign) return;
      storage.pushUndo();
      const cycle = getActiveCycle();
      delete cycle.assignments[selectedDateForReassign];
      delete cycle.manualOverrides[selectedDateForReassign];
      cycle.updatedAt = Date.now();
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Shift for \${selectedDateForReassign} cleared.\`);
    });

    // -------------------------------------------------------------
    // 5. Import Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-import').addEventListener('click', () => {
      closeAllModals();
      modalOverlay.classList.add('open');
      modalImport.style.display = 'flex';
    });

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', handleFile);

    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files.length) handleFile({ target: { files: e.dataTransfer.files } });
    });

    function handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      const isCsv = file.name.endsWith('.csv');

      reader.onload = function(evt) {
        const data = evt.target.result;
        const result = parseSpreadsheet(window.XLSX, data, isCsv);
        pendingImportShifts = result.parsedShifts;

        // Check for unmatched names
        const activeNames = new Set(window.appState.roster.map(m => m.name));
        const unmatched = result.rawNames.filter(n => !activeNames.has(n));

        if (unmatched.length > 0) {
          openAliasModal(unmatched);
        } else {
          commitImport({});
        }
      };

      if (isCsv) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    }

    function openAliasModal(unmatched) {
      const list = document.getElementById('alias-mapping-list');
      const allRosterAndHistorical = [...window.appState.roster, ...HISTORICAL_MEMBERS];

      list.innerHTML = unmatched.map(alias => \`
        <div style="margin-bottom:14px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid var(--border-color);">
          <div style="font-weight:700; margin-bottom:6px;">Unmatched Alias: <span style="color:var(--danger)">\${alias}</span></div>
          <select class="form-select alias-select" data-alias="\${alias}">
            <option value="">-- Leave Unassigned --</option>
            \${allRosterAndHistorical.map(m => \`<option value="\${m.id}">Map to \${m.name} (\${m.role})</option>\`).join('')}
            <option value="__NEW_INACTIVE__">+ Create as Historical Inactive Member</option>
          </select>
        </div>
      \`).join('');

      closeAllModals();
      modalOverlay.classList.add('open');
      modalAlias.style.display = 'flex';
    }

    document.getElementById('btn-confirm-alias').addEventListener('click', () => {
      const aliasMap = {};
      modalAlias.querySelectorAll('.alias-select').forEach(sel => {
        const alias = sel.getAttribute('data-alias');
        const val = sel.value;
        if (val === '__NEW_INACTIVE__') {
          const newId = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          window.appState.roster.push({
            id: newId,
            name: alias,
            role: 'FT',
            activeStart: '2026-01-01',
            activeEnd: '2027-01-01',
            color: '#64748b'
          });
          aliasMap[alias] = newId;
        } else if (val) {
          aliasMap[alias] = val;
        }
      });

      closeAllModals();
      commitImport(aliasMap);
    });

    function commitImport(aliasMap) {
      if (!pendingImportShifts) return;
      storage.pushUndo();
      const cycle = getActiveCycle();

      pendingImportShifts.forEach(({ dateStr, rawName }) => {
        if (!rawName) return;
        let member = window.appState.roster.find(m => m.name === rawName);
        if (member) {
          cycle.assignments[dateStr] = member.id;
        } else if (aliasMap[rawName]) {
          cycle.assignments[dateStr] = aliasMap[rawName];
        }
      });

      cycle.updatedAt = Date.now();
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Import complete! \${pendingImportShifts.length} shifts loaded.\`);
      pendingImportShifts = null;
    }

    // Export to Excel
    document.getElementById('btn-export-excel').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const wb = generateExcelWorkbook(window.XLSX, cycle, window.appState.roster, cycle.assignments);
      window.XLSX.writeFile(wb, \`\${cycle.year}_\${cycle.blockType}_Fire_Marshal_OnCall_Schedule.xlsx\`);
      showToast('Excel workbook exported.');
    });

    // Print
    // Print All Months: render every month of the cycle, then print once
    document.getElementById('btn-print-all').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const savedIdx = activeMonthIdx;
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const printContainer = document.getElementById('print-all-container');
      printContainer.innerHTML = '';
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      while (curr <= end) {
        activeMonthIdx = curr.getMonth();
        renderCalendar();
        const clone = viewCalendarWrapper.querySelector('.calendar-container').cloneNode(true);
        printContainer.appendChild(clone);
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      activeMonthIdx = savedIdx;
      renderCalendar();
      document.body.classList.add('printing-all');
      const cleanup = () => {
        document.body.classList.remove('printing-all');
        printContainer.innerHTML = '';
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
    });

    document.getElementById('btn-print').addEventListener('click', () => {
      window.print();
    });

    // -------------------------------------------------------------
    // Backup / Restore (JSON)
    // -------------------------------------------------------------
    document.getElementById('btn-backup-export').addEventListener('click', () => {
      const json = storage.exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'PSP_FireMarshal_Backup_' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup downloaded: ' + a.download);
    });

    const backupFileInput = document.getElementById('backup-file-input');
    document.getElementById('btn-backup-restore').addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', () => {
      const file = backupFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (!confirm('Restore from "' + file.name + '"? This replaces ALL current data (roster, blackouts, requests and schedules).')) {
          backupFileInput.value = '';
          return;
        }
        if (storage.importBackupJSON(evt.target.result)) {
          window.appState = storage.state;
          if (!window.appState.preferredWeekends) window.appState.preferredWeekends = [];
          const c = getActiveCycle();
          activeMonthIdx = parseDate(c.startDate).getMonth();
          closeAllModals();
          renderApp();
          showToast('Backup restored.');
        } else {
          alert('That file is not a valid backup from this program.');
        }
        backupFileInput.value = '';
      };
      reader.readAsText(file);
    });
    // Initial render
    renderApp();
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', htmlContent, 'utf8');
console.log('Successfully generated 100% self-contained index.html!');
