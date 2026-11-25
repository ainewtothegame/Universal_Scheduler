/**
 * excel_engine.js
 * Excel / CSV import and export engine for PSP Universal Scheduler.
 * Supports single-slot 7-column grids, AM/PM multi-slot rows, and 2-column CSV/XLSX tables.
 */

import { parseDate, formatDate, addDays } from './domain_data.js';
import {
  createUnitConfig,
  normalizeUnitConfig,
  isMultiSlotConfig,
  getSlotMember,
  DAY_NAMES
} from './unit_config.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Builds a 7-column monthly grid structure for export (respecting weekStartDay and coverageSlots).
 */
export function buildBarracksCalendarGrid(cycle, roster, assignments, rawUnitConfig = null) {
  const unitConfig = normalizeUnitConfig(rawUnitConfig || createUnitConfig('fire_marshal'));
  const weekStartDay = unitConfig.weekStartDay === 0 ? 0 : 1;
  const slots = unitConfig.coverageSlots;
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const months = [];

  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= lastMonth) {
    const year = curr.getFullYear();
    const monthIdx = curr.getMonth();
    const monthName = MONTH_NAMES[monthIdx];

    const firstDayOfMonth = new Date(year, monthIdx, 1);
    const lastDayOfMonth = new Date(year, monthIdx + 1, 0);

    const firstDow = firstDayOfMonth.getDay();
    const startOffset = -((firstDow - weekStartDay + 7) % 7);
    let weekStart = addDays(firstDayOfMonth, startOffset);

    const weeks = [];
    while (weekStart <= lastDayOfMonth) {
      const dates = [];
      const names = [];
      const slotRows = slots.map(s => ({ slotId: s.id, label: s.label, names: [] }));

      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const dStr = formatDate(d);
        dates.push(dStr);

        slots.forEach((s, idx) => {
          const assignedId = getSlotMember(assignments, dStr, s.id, unitConfig);
          const mem = roster.find(m => m.id === assignedId);
          const displayName = mem ? mem.name : (assignedId || '');
          slotRows[idx].names.push(displayName);
          if (idx === 0) names.push(displayName);
        });
      }

      weeks.push({ dates, names, slotRows });
      weekStart = addDays(weekStart, 7);
    }

    months.push({
      year,
      monthName,
      monthIdx,
      weeks
    });

    curr = new Date(year, monthIdx + 1, 1);
  }

  return months;
}

/**
 * Generates an .xlsx workbook using SheetJS (XLSX).
 */
export function generateExcelWorkbook(XLSX, cycle, roster, assignments, rawUnitConfig = null) {
  const unitConfig = normalizeUnitConfig(rawUnitConfig || createUnitConfig('fire_marshal'));
  const multiSlot = isMultiSlotConfig(unitConfig);
  const weekStartDay = unitConfig.weekStartDay === 0 ? 0 : 1;
  const dayHeaders = [];
  for (let i = 0; i < 7; i++) {
    dayHeaders.push(DAY_NAMES[(weekStartDay + i) % 7].toUpperCase());
  }

  const wb = XLSX.utils.book_new();
  const months = buildBarracksCalendarGrid(cycle, roster, assignments, unitConfig);
  const rows = [];

  months.forEach(m => {
    rows.push(['', String(m.year), m.monthName, unitConfig.unitName || '', '', '', '', '']);
    rows.push(['', ...dayHeaders]);

    m.weeks.forEach(w => {
      rows.push(['', ...w.dates]);
      if (!multiSlot) {
        rows.push(['', ...w.names]);
      } else {
        w.slotRows.forEach(sr => {
          rows.push([sr.label, ...sr.names]);
        });
      }
    });

    rows.push(['', '', 'Notes:', '', '', '', '', '']);
    rows.push(['', '', unitConfig.footerNote || 'On-call coverage per unit rules.', '', '', '', '', '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: multiSlot ? 12 : 4 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${cycle.year}_Schedule`);
  return wb;
}

/**
 * Minimal RFC-4180 CSV parser: quoted fields, embedded commas/newlines, "" escapes.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else { cell += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else { cell += ch; }
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

/**
 * Parses any incoming spreadsheet (CSV text or SheetJS Workbook) into daily assignments.
 */
export function parseSpreadsheet(XLSX, fileData, isRawCsv = false) {
  let sheetData = [];

  if (isRawCsv) {
    sheetData = parseCsv(fileData);
  } else {
    const wb = XLSX.read(fileData, { type: 'binary', cellDates: true });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    sheetData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' });
  }

  const parsedShifts = [];
  const rawNamesFound = new Set();

  let startDayRowIdx = -1;
  let startDayColIdx = -1;

  for (let r = 0; r < Math.min(sheetData.length, 25); r++) {
    const row = sheetData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').toUpperCase().trim();
      if (val === 'MONDAY' || val === 'SUNDAY') {
        startDayRowIdx = r;
        startDayColIdx = c;
        break;
      }
    }
    if (startDayRowIdx !== -1) break;
  }

  if (startDayRowIdx !== -1) {
    for (let r = 0; r < sheetData.length - 1; r++) {
      const row = sheetData[r] || [];

      let isDateRow = false;
      for (let c = startDayColIdx; c < startDayColIdx + 7; c++) {
        const cell = String(row[c] || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(cell)) {
          isDateRow = true;
          break;
        }
      }

      if (isDateRow) {
        // Consume 1 or more immediate non-date rows beneath the date row (supports single or AM/PM rows)
        let offset = 1;
        while (r + offset < sheetData.length) {
          const nextRow = sheetData[r + offset] || [];
          const hasDateInNext = nextRow.slice(startDayColIdx, startDayColIdx + 7).some(cell => /^\d{4}-\d{2}-\d{2}$/.test(String(cell || '').trim()));
          const labelCell = String(nextRow[Math.max(0, startDayColIdx - 1)] || '').trim().toUpperCase();
          const firstCell = String(nextRow[startDayColIdx] || '').trim().toUpperCase();
          if (hasDateInNext || firstCell === 'NOTES:' || labelCell === 'NOTES:' || firstCell === 'MONDAY' || firstCell === 'SUNDAY') {
            break;
          }
          const isBlankRow = nextRow.slice(startDayColIdx, startDayColIdx + 7).every(cell => !String(cell || '').trim());
          if (isBlankRow) break;

          const slotHint = labelCell || null;
          for (let c = startDayColIdx; c < startDayColIdx + 7; c++) {
            const dateStr = String(row[c] || '').trim();
            const rawName = String(nextRow[c] || '').trim().toUpperCase();

            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              parsedShifts.push({ dateStr, rawName, slotHint });
              if (rawName && rawName !== 'NOTES:' && rawName !== '') {
                rawNamesFound.add(rawName);
              }
            }
          }
          offset++;
          // Single-slot grids have an empty label column; only consume additional rows when slot-labeled
          if (!labelCell) break;
        }
        r += (offset - 1);
      }
    }
  } else {
    let dateCol = 0;
    let nameCol = 1;

    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const row = sheetData[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase();
        if (val.includes('date')) dateCol = c;
        if (val.includes('name') || val.includes('member') || val.includes('person') || val.includes('officer')) nameCol = c;
      }
    }

    for (let r = 0; r < sheetData.length; r++) {
      const row = sheetData[r] || [];
      const rawDate = String(row[dateCol] || '').trim();
      const rawName = String(row[nameCol] || '').trim().toUpperCase();

      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        parsedShifts.push({ dateStr: rawDate, rawName });
        if (rawName) rawNamesFound.add(rawName);
      }
    }
  }

  return {
    parsedShifts,
    rawNames: Array.from(rawNamesFound)
  };
}
