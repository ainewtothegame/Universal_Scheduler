/**
 * build_single_file.js
 * Inlines all styles, scripts, and SheetJS into a single portable index.html file.
 */

import fs from 'fs';
import path from 'path';

console.log('Building standalone index.html...');

const sheetJsCode = fs.readFileSync('xlsx.full.min.js', 'utf8');

// Build the HTML template
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
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cycle-select {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .cycle-select option { color: var(--text-main); background: #ffffff; }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s ease, transform 0.05s ease;
    }
    .btn:active { transform: scale(0.98); }

    .btn-light {
      background: #ffffff;
      color: var(--primary);
    }
    .btn-light:hover { background: #f1f5f9; }

    .btn-outline {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.4);
      color: #ffffff;
    }
    .btn-outline:hover { background: rgba(255,255,255,0.1); }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    .btn-danger {
      background: var(--danger);
      color: #ffffff;
    }
    .btn-danger:hover { background: #b91c1c; }

    .btn-warning {
      background: var(--warning);
      color: #ffffff;
    }
    .btn-warning:hover { background: #b45309; }

    /* Action Ribbon */
    .ribbon {
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      padding: 8px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .tab-group {
      display: flex;
      gap: 4px;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
    }
    .tab-btn {
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }
    .tab-btn.active {
      background: #ffffff;
      color: var(--primary);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .ribbon-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Month Selector Tabs */
    .month-tabs {
      display: flex;
      gap: 6px;
      padding: 12px 24px;
      overflow-x: auto;
      background: #f8fafc;
      border-bottom: 1px solid var(--border-color);
    }
    .month-tab {
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 600;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      cursor: pointer;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .month-tab.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 20px 24px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    /* Calendar Grid View */
    .calendar-container {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .calendar-header {
      padding: 14px 20px;
      background: #f8fafc;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .calendar-title {
      font-size: 18px;
      font-weight: 700;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-collapse: collapse;
    }

    .dow-header {
      background: #f1f5f9;
      padding: 10px;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      text-transform: uppercase;
    }
    .dow-header:last-child { border-right: none; }

    .day-cell {
      min-height: 110px;
      padding: 8px;
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      background: #ffffff;
      display: flex;
      flex-direction: column;
      position: relative;
      cursor: pointer;
      transition: background 0.1s ease;
    }
    .day-cell:nth-child(7n) { border-right: none; }
    .day-cell:hover { background: #f8fafc; }
    .day-cell.other-month { background: #fbfcfe; opacity: 0.6; }
    .day-cell.weekend-col { background: #fdfdfd; }
    .day-cell.resting-rdo {
      background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px);
    }

    .day-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .day-num {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
    }
    .holiday-pill {
      font-size: 10px;
      background: #fee2e2;
      color: #991b1b;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }

    .assignment-chip {
      margin-top: auto;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .unassigned-chip {
      background: #e2e8f0;
      color: #64748b;
      border: 1px dashed #cbd5e1;
      box-shadow: none;
      font-weight: 600;
    }

    .conflict-badges {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .conflict-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-error { background: var(--danger); }
    .dot-warning { background: var(--warning); }
    .dot-attention { background: #3b82f6; }

    /* Operational Footnote */
    .calendar-footer {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Drawers & Modals */
    .drawer-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 100;
      display: none;
    }
    .drawer-overlay.open { display: block; }

    .drawer {
      position: fixed;
      top: 0; right: -480px; bottom: 0;
      width: 480px;
      background: #ffffff;
      z-index: 101;
      box-shadow: -4px 0 16px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      transition: right 0.25s ease;
    }
    .drawer.open { right: 0; }

    .drawer-header {
      padding: 16px 20px;
      background: var(--primary);
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-title { font-size: 16px; font-weight: 700; }
    .drawer-close {
      background: none; border: none; color: #ffffff; font-size: 20px; cursor: pointer;
    }

    .drawer-body {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }

    .form-group {
      margin-bottom: 16px;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .form-input, .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 13px;
    }

    .item-card {
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Modal Center */
    .modal {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      width: 540px;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
      z-index: 102;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .modal.open { display: flex; }
    .modal-header {
      padding: 16px 20px;
      background: var(--primary);
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
    }
    .modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; font-size: 14px; }
    .modal-footer {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Overview Matrix Table */
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .matrix-table th, .matrix-table td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }
    .matrix-table th { background: #f1f5f9; font-weight: 700; }

    /* Print Stylesheet */
    @media print {
      header, .ribbon, .month-tabs, .btn, .drawer-overlay, .drawer, .modal {
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
      <select id="cycle-select" class="cycle-select">
        <option value="2027-H1">2027 H1 (Jan 1 – Jun 30)</option>
        <option value="2027-H2">2027 H2 (Jul 1 – Dec 31)</option>
        <option value="2027-FULL">2027 Full Year</option>
      </select>
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
    </div>
    <div class="ribbon-actions">
      <button id="btn-open-roster" class="btn btn-outline" style="color:var(--text-main); border-color:var(--border-color);">&#128101; Roster (<span id="roster-count">7</span>)</button>
      <button id="btn-open-blackouts" class="btn btn-outline" style="color:var(--text-main); border-color:var(--border-color);">&#128197; Blackouts (<span id="blackout-count">0</span>)</button>
      <button id="btn-open-import" class="btn btn-outline" style="color:var(--text-main); border-color:var(--border-color);">&#128196; Import</button>
      <button id="btn-export-excel" class="btn btn-primary">&#128229; Export to Excel</button>
      <button id="btn-print" class="btn btn-outline" style="color:var(--text-main); border-color:var(--border-color);">&#128424; Print</button>
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
          <div><strong>Notes:</strong> On call starts PM that day (after scheduled shift) and into the next morning (0600hrs).</div>
          <div id="exemption-note" style="color:var(--danger); font-weight:600; display:none;">* Administrative Exemption: Manual Alternate Weekday Assignment</div>
        </div>
      </div>
    </div>

    <!-- Matrix View (Hidden by default) -->
    <div id="view-matrix-wrapper" style="display:none;">
      <div class="calendar-container" style="padding:20px;">
        <h2 style="font-size:18px; margin-bottom:16px;">Cycle Shift Matrix & Weekend Rest Overview</h2>
        <div id="matrix-table-container"></div>
      </div>
    </div>
  </main>

  <!-- Drawer Overlay Backdrop -->
  <div id="drawer-overlay" class="drawer-overlay"></div>

  <!-- Roster Drawer -->
  <div id="drawer-roster" class="drawer">
    <div class="drawer-header">
      <div class="drawer-title">Manage Personnel Roster</div>
      <button id="close-roster" class="drawer-close">&times;</button>
    </div>
    <div class="drawer-body">
      <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:var(--text-muted);">Active Fire Marshals & Alternates</span>
        <button id="btn-add-member" class="btn btn-primary" style="padding:4px 10px; font-size:12px;">+ Add Member</button>
      </div>
      <div id="roster-list"></div>
    </div>
  </div>

  <!-- Blackout / Vacation Drawer -->
  <div id="drawer-blackouts" class="drawer">
    <div class="drawer-header">
      <div class="drawer-title">Vacations & Blackout Booking</div>
      <button id="close-blackouts" class="drawer-close">&times;</button>
    </div>
    <div class="drawer-body">
      <div style="background:#f1f5f9; padding:12px; border-radius:8px; margin-bottom:16px;">
        <div style="font-weight:700; font-size:13px; margin-bottom:10px;">Book New Leave / Blackout Range</div>
        <div class="form-group">
          <label class="form-label">Member</label>
          <select id="book-member" class="form-select"></select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" id="book-start" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" id="book-end" class="form-input">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Reason / Notes</label>
          <input type="text" id="book-notes" class="form-input" placeholder="e.g. Summer Vacation, Military Leave">
        </div>
        <button id="btn-save-blackout" class="btn btn-primary" style="width:100%; justify-content:center;">Book Blackout Range</button>
      </div>

      <div style="font-weight:700; font-size:13px; margin-bottom:10px;">Approved Blackouts (<span id="blackout-list-count">0</span>)</div>
      <div id="blackouts-list"></div>
    </div>
  </div>

  <!-- Import Drawer -->
  <div id="drawer-import" class="drawer">
    <div class="drawer-header">
      <div class="drawer-title">Import Barracks Schedule</div>
      <button id="close-import" class="drawer-close">&times;</button>
    </div>
    <div class="drawer-body">
      <div style="border: 2px dashed var(--border-color); border-radius:10px; padding:30px 20px; text-align:center; background:#f8fafc; cursor:pointer;" id="drop-zone">
        <div style="font-size:32px; margin-bottom:10px;">&#128194;</div>
        <div style="font-weight:700; font-size:15px; margin-bottom:4px;">Drag & Drop Excel or CSV here</div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Supports 7-Column Barracks Calendars & 2-Column Date Lists</div>
        <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none;">
        <button type="button" class="btn btn-outline" style="color:var(--primary); border-color:var(--primary);" onclick="document.getElementById('file-input').click()">Browse Files</button>
      </div>
      <div id="import-preview" style="margin-top:20px; font-size:13px; display:none;"></div>
    </div>
  </div>

  <!-- Unmatched Name Resolution Modal -->
  <div id="modal-alias" class="modal">
    <div class="modal-header">
      <div>Reconcile Unmatched Personnel Names</div>
      <button id="close-modal-alias" class="drawer-close">&times;</button>
    </div>
    <div class="modal-body">
      <p style="margin-bottom:16px; color:var(--text-muted);">
        The imported file contains names not found in your active roster. Please map each alias to an existing member or register as a historical record:
      </p>
      <div id="alias-mapping-list"></div>
    </div>
    <div class="modal-footer">
      <button id="btn-cancel-alias" class="btn btn-outline" style="color:var(--text-main); border-color:var(--border-color);">Cancel</button>
      <button id="btn-confirm-alias" class="btn btn-primary">Apply Reconciled Schedule</button>
    </div>
  </div>

  <!-- Reassign Popover Modal -->
  <div id="modal-reassign" class="modal" style="width:380px;">
    <div class="modal-header">
      <div id="reassign-date-title">Reassign Shift</div>
      <button id="close-modal-reassign" class="drawer-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Assign Investigator</label>
        <select id="reassign-member-select" class="form-select"></select>
      </div>
      <div id="reassign-conflict-preview" style="margin-top:10px; font-size:12px;"></div>
    </div>
    <div class="modal-footer">
      <button id="btn-clear-shift" class="btn btn-danger" style="margin-right:auto;">Clear Shift</button>
      <button id="btn-save-shift" class="btn btn-primary">Save Assignment</button>
    </div>
  </div>

  <!-- Inlined SheetJS Library -->
  <script>
    ${sheetJsCode}
  </script>

  <!-- Core Application Scripts -->
  <script type="module">
    import { DEFAULT_2027_ROSTER, HISTORICAL_MEMBERS, DEFAULT_2027_HOLIDAYS, DEFAULT_2027_BLACKOUTS, createInitialAppState, formatDate, parseDate, addDays, getDayOfWeek } from './src/domain_data.js';
    import { solveSchedule, identifyWeekends } from './src/csp_solver.js';
    import { evaluateScheduleConflicts } from './src/conflict_engine.js';
    import { generateExcelWorkbook, parseSpreadsheet, buildBarracksCalendarGrid } from './src/excel_engine.js';
    import { StorageAdapter } from './src/storage_adapter.js';

    // Initialize Storage & State
    const storage = new StorageAdapter();
    window.appState = storage.state;

    let activeMonthIdx = 0; // 0=Jan
    let selectedDateForReassign = null;
    let pendingImportShifts = null;

    // DOM Elements
    const cycleSelect = document.getElementById('cycle-select');
    const monthTabsBar = document.getElementById('month-tabs-bar');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const calendarSummaryStat = document.getElementById('calendar-summary-stat');
    const exemptionNote = document.getElementById('exemption-note');
    const rosterCount = document.getElementById('roster-count');
    const blackoutCount = document.getElementById('blackout-count');
    const blackoutListCount = document.getElementById('blackout-list-count');

    // Tab buttons
    const tabCalendarView = document.getElementById('tab-calendar-view');
    const tabMatrixView = document.getElementById('tab-matrix-view');
    const viewCalendarWrapper = document.getElementById('view-calendar-wrapper');
    const viewMatrixWrapper = document.getElementById('view-matrix-wrapper');

    // Drawers
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerRoster = document.getElementById('drawer-roster');
    const drawerBlackouts = document.getElementById('drawer-blackouts');
    const drawerImport = document.getElementById('drawer-import');
    const modalAlias = document.getElementById('modal-alias');
    const modalReassign = document.getElementById('modal-reassign');

    function getActiveCycle() {
      return window.appState.cycles[window.appState.activeCycleId];
    }

    // Refresh UI
    function renderApp() {
      const cycle = getActiveCycle();
      rosterCount.textContent = window.appState.roster.length;
      blackoutCount.textContent = window.appState.blackouts.length;
      blackoutListCount.textContent = window.appState.blackouts.length;

      renderMonthTabs();
      renderCalendar();
      renderMatrix();
    }

    // Render Month Tabs
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

      // Check exemption note
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
                <span style="font-size:10px; opacity:0.8;">\${member.role}</span>
              </div>
            \`;
          } else {
            chipHtml = \`<div class="assignment-chip unassigned-chip">UNASSIGNED</div>\`;
          }

          let dotsHtml = '';
          if (hasError || hasWarning || hasAttention) {
            dotsHtml = '<div class="conflict-badges">';
            if (hasError) dotsHtml += '<div class="conflict-dot dot-error" title="Rest or Blackout Violation"></div>';
            if (hasWarning) dotsHtml += '<div class="conflict-dot dot-warning" title="Warning / Quota Breach"></div>';
            if (hasAttention) dotsHtml += '<div class="conflict-dot dot-attention" title="Multi-Shift Coverage"></div>';
            dotsHtml += '</div>';
          }

          cellsHtml += \`
            <div class="day-cell \${!isCurrentMonth ? 'other-month' : ''} \${isWeekend ? 'weekend-col' : ''}" data-date="\${dStr}">
              <div class="day-top">
                <span class="day-num">\${d.getDate()}</span>
                \${holiday ? \`<span class="holiday-pill" title="\${holiday.name}">\${holiday.name}</span>\` : ''}
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

    // Drawer management
    function closeDrawers() {
      drawerOverlay.classList.remove('open');
      drawerRoster.classList.remove('open');
      drawerBlackouts.classList.remove('open');
      drawerImport.classList.remove('open');
      modalAlias.classList.remove('open');
      modalReassign.classList.remove('open');
    }

    drawerOverlay.addEventListener('click', closeDrawers);
    document.getElementById('close-roster').addEventListener('click', closeDrawers);
    document.getElementById('close-blackouts').addEventListener('click', closeDrawers);
    document.getElementById('close-import').addEventListener('click', closeDrawers);
    document.getElementById('close-modal-alias').addEventListener('click', closeDrawers);
    document.getElementById('close-modal-reassign').addEventListener('click', closeDrawers);
    document.getElementById('btn-cancel-alias').addEventListener('click', closeDrawers);

    // Tab view switching
    tabCalendarView.addEventListener('click', () => {
      tabCalendarView.classList.add('active');
      tabMatrixView.classList.remove('active');
      viewCalendarWrapper.style.display = 'block';
      viewMatrixWrapper.style.display = 'none';
      monthTabsBar.style.display = 'flex';
    });

    tabMatrixView.addEventListener('click', () => {
      tabMatrixView.classList.add('active');
      tabCalendarView.classList.remove('active');
      viewCalendarWrapper.style.display = 'none';
      viewMatrixWrapper.style.display = 'block';
      monthTabsBar.style.display = 'none';
      renderMatrix();
    });

    // Auto-Generate Schedule
    document.getElementById('btn-solve').addEventListener('click', () => {
      storage.pushUndo();
      const cycle = getActiveCycle();
      const result = solveSchedule(cycle, window.appState.roster, window.appState.blackouts, window.appState.holidays, cycle.manualOverrides);
      cycle.assignments = result.assignments;
      cycle.solverDiagnostics = result.diagnostics;
      cycle.updatedAt = Date.now();
      storage.saveState();
      renderApp();
      alert('Schedule automatically generated! All fatigue and quota rules applied.');
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (storage.undo()) renderApp();
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      if (storage.redo()) renderApp();
    });

    // Open Roster Drawer
    document.getElementById('btn-open-roster').addEventListener('click', () => {
      renderRosterList();
      drawerOverlay.classList.add('open');
      drawerRoster.classList.add('open');
    });

    function renderRosterList() {
      const list = document.getElementById('roster-list');
      list.innerHTML = window.appState.roster.map(m => \`
        <div class="item-card">
          <div>
            <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
              <span style="width:12px; height:12px; border-radius:50%; background:\${m.color}; display:inline-block;"></span>
              \${m.name}
              <span style="font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; background:\${m.role === 'FT' ? '#e0f2fe' : '#fef3c7'}; color:\${m.role === 'FT' ? '#0369a1' : '#b45309'}">\${m.role}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              Active: \${m.activeStart} \${m.activeEnd ? \`to \${m.activeEnd}\` : '(Indefinite)'}
              \${m.baselineWeekday ? \`| Preferred: Day \${m.baselineWeekday}\` : ''}
            </div>
          </div>
          <button class="btn btn-outline btn-delete-member" data-id="\${m.id}" style="color:var(--danger); border-color:var(--danger); padding:4px 8px; font-size:11px;">Remove</button>
        </div>
      \`).join('');

      list.querySelectorAll('.btn-delete-member').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Remove member from roster?')) {
            window.appState.roster = window.appState.roster.filter(m => m.id !== id);
            storage.saveState();
            renderRosterList();
            renderApp();
          }
        });
      });
    }

    // Add Member
    document.getElementById('btn-add-member').addEventListener('click', () => {
      const name = prompt('Enter investigator uppercase last name (e.g. SMITH):');
      if (!name) return;
      const role = confirm('Is this member Full-Time (OK) or Alternate (Cancel)?') ? 'FT' : 'ALT';
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      window.appState.roster.push({
        id,
        name: name.toUpperCase(),
        role,
        activeStart: '2027-01-01',
        activeEnd: null,
        baselineWeekday: role === 'FT' ? 1 : null,
        color: role === 'FT' ? '#0284c7' : '#9333ea'
      });
      storage.saveState();
      renderRosterList();
      renderApp();
    });

    // Open Blackouts Drawer
    document.getElementById('btn-open-blackouts').addEventListener('click', () => {
      renderBlackoutInputs();
      renderBlackoutsList();
      drawerOverlay.classList.add('open');
      drawerBlackouts.classList.add('open');
    });

    function renderBlackoutInputs() {
      const select = document.getElementById('book-member');
      select.innerHTML = window.appState.roster.map(m => \`<option value="\${m.id}">\${m.name} (\${m.role})</option>\`).join('');
    }

    function renderBlackoutsList() {
      const list = document.getElementById('blackouts-list');
      list.innerHTML = window.appState.blackouts.map(b => {
        const mem = window.appState.roster.find(m => m.id === b.memberId);
        return \`
          <div class="item-card">
            <div>
              <div style="font-weight:700; font-size:13px;">\${mem?.name || b.memberId}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                \${b.startDate} &rarr; \${b.endDate} \${b.notes ? \`(\${b.notes})\` : ''}
              </div>
            </div>
            <button class="btn btn-outline btn-delete-blackout" data-id="\${b.id}" style="color:var(--danger); border-color:var(--danger); padding:4px 8px; font-size:11px;">Delete</button>
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
        });
      });
    }

    document.getElementById('btn-save-blackout').addEventListener('click', () => {
      const memberId = document.getElementById('book-member').value;
      const startDate = document.getElementById('book-start').value;
      const endDate = document.getElementById('book-end').value;
      const notes = document.getElementById('book-notes').value;

      if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
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
        notes: notes || 'Time off'
      });
      storage.saveState();
      renderBlackoutsList();
      renderApp();
      document.getElementById('book-start').value = '';
      document.getElementById('book-end').value = '';
      document.getElementById('book-notes').value = '';
    });

    // Reassign Shift Modal
    function openReassignModal(dateStr) {
      selectedDateForReassign = dateStr;
      const cycle = getActiveCycle();
      const currentAssigned = cycle.assignments[dateStr];

      document.getElementById('reassign-date-title').textContent = \`Shift Assignment for \${dateStr}\`;
      const select = document.getElementById('reassign-member-select');
      select.innerHTML = '<option value="">-- UNASSIGNED --</option>' +
        window.appState.roster.map(m => \`
          <option value="\${m.id}" \${m.id === currentAssigned ? 'selected' : ''}>
            \${m.name} (\${m.role})
          </option>
        \`).join('');

      drawerOverlay.classList.add('open');
      modalReassign.classList.add('open');
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
      closeDrawers();
      renderApp();
    });

    document.getElementById('btn-clear-shift').addEventListener('click', () => {
      if (!selectedDateForReassign) return;
      storage.pushUndo();
      const cycle = getActiveCycle();
      delete cycle.assignments[selectedDateForReassign];
      delete cycle.manualOverrides[selectedDateForReassign];
      cycle.updatedAt = Date.now();
      storage.saveState();
      closeDrawers();
      renderApp();
    });

    // Import Handling
    document.getElementById('btn-open-import').addEventListener('click', () => {
      drawerOverlay.classList.add('open');
      drawerImport.classList.add('open');
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

      closeDrawers();
      drawerOverlay.classList.add('open');
      modalAlias.classList.add('open');
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

      closeDrawers();
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
      renderApp();
      alert(\`Import successful! \${pendingImportShifts.length} date shifts processed.\`);
      pendingImportShifts = null;
    }

    // Export to Excel
    document.getElementById('btn-export-excel').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const wb = generateExcelWorkbook(window.XLSX, cycle, window.appState.roster, cycle.assignments);
      window.XLSX.writeFile(wb, \`\${cycle.year}_\${cycle.blockType}_Fire_Marshal_OnCall_Schedule.xlsx\`);
    });

    // Print
    document.getElementById('btn-print').addEventListener('click', () => {
      window.print();
    });

    // Cycle Change
    cycleSelect.addEventListener('change', (e) => {
      window.appState.activeCycleId = e.target.value;
      storage.saveState();
      activeMonthIdx = window.appState.activeCycleId === '2027-H2' ? 6 : 0;
      renderApp();
    });

    // Initial render
    renderApp();
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', htmlContent, 'utf8');
console.log('Successfully generated index.html!');
