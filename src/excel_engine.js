/**
 * excel_engine.js
 * Excel / CSV import and export engine for PSP Fire Marshal barracks calendar format.
 */

import { parseDate, formatDate, addDays, getDayOfWeek } from './domain_data.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Builds a 7-column barracks monthly grid structure for export.
 */
export function buildBarracksCalendarGrid(cycle, roster, assignments) {
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const months = [];

  // Group by year and month
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= lastMonth) {
    const year = curr.getFullYear();
    const monthIdx = curr.getMonth();
    const monthName = MONTH_NAMES[monthIdx];

    // Find all calendar weeks for this month (Monday through Sunday)
    // First day of month
    const firstDayOfMonth = new Date(year, monthIdx, 1);
    const lastDayOfMonth = new Date(year, monthIdx + 1, 0);

    // Find the Monday of the first week (could be in preceding month)
    const firstDow = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const mondayOffset = firstDow === 0 ? -6 : (1 - firstDow);
    let weekMonday = addDays(firstDayOfMonth, mondayOffset);

    const weeks = [];
    while (weekMonday <= lastDayOfMonth) {
      const dates = [];
      const names = [];

      for (let i = 0; i < 7; i++) {
        const d = addDays(weekMonday, i);
        const dStr = formatDate(d);
        dates.push(dStr);

        const assignedId = assignments[dStr];
        const mem = roster.find(m => m.id === assignedId);
        names.push(mem ? mem.name : (assignedId || ''));
      }

      weeks.push({ dates, names });
      weekMonday = addDays(weekMonday, 7);
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
export function generateExcelWorkbook(XLSX, cycle, roster, assignments) {
  const wb = XLSX.utils.book_new();
  const months = buildBarracksCalendarGrid(cycle, roster, assignments);

  // Build rows for single master worksheet (or individual month sheets)
  const rows = [];

  months.forEach(m => {
    // Row 1: Year, MonthName
    rows.push(['', String(m.year), m.monthName, '', '', '', '', '']);
    // Row 2: Days of week
    rows.push(['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

    // Weeks
    m.weeks.forEach(w => {
      rows.push(['', ...w.dates]);
      rows.push(['', ...w.names]);
    });

    // Operational Notes
    rows.push(['', '', 'Notes:', '', '', '', '', '']);
    rows.push(['', '', 'On call starts PM that day (after scheduled shift) and into the next morning (0600hrs).', '', '', '', '', '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 4 },  // Column A (spacer)
    { wch: 14 }, // Mon
    { wch: 14 }, // Tue
    { wch: 14 }, // Wed
    { wch: 14 }, // Thu
    { wch: 14 }, // Fri
    { wch: 14 }, // Sat
    { wch: 14 }  // Sun
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${cycle.year}_Schedule`);
  return wb;
}

/**
 * Parses any incoming spreadsheet (CSV text or SheetJS Workbook) into daily assignments.
 */
export function parseSpreadsheet(XLSX, fileData, isRawCsv = false) {
  let sheetData = [];

  if (isRawCsv) {
    // Parse CSV lines
    sheetData = fileData.split(/\r?\n/).map(line => {
      // Split by comma preserving quotes if needed
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });
  } else {
    // Read via SheetJS
    const wb = XLSX.read(fileData, { type: 'binary', cellDates: true });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    sheetData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' });
  }

  const parsedShifts = []; // Array of { dateStr, rawName }
  const rawNamesFound = new Set();

  // Heuristic 1: Detect 7-Column Grid Format by searching for 'MONDAY'
  let mondayRowIdx = -1;
  let mondayColIdx = -1;

  for (let r = 0; r < Math.min(sheetData.length, 25); r++) {
    const row = sheetData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').toUpperCase().trim();
      if (val === 'MONDAY') {
        mondayRowIdx = r;
        mondayColIdx = c;
        break;
      }
    }
    if (mondayRowIdx !== -1) break;
  }

  if (mondayRowIdx !== -1) {
    // 7-Column Grid detected!
    // Scan all rows. When we find a row of ISO dates (YYYY-MM-DD), the immediate next row is names
    for (let r = 0; r < sheetData.length - 1; r++) {
      const row = sheetData[r] || [];
      const nextRow = sheetData[r + 1] || [];

      // Check if this row has at least one date string matching /^\d{4}-\d{2}-\d{2}$/
      let isDateRow = false;
      for (let c = mondayColIdx; c < mondayColIdx + 7; c++) {
        const cell = String(row[c] || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(cell)) {
          isDateRow = true;
          break;
        }
      }

      if (isDateRow) {
        for (let c = mondayColIdx; c < mondayColIdx + 7; c++) {
          const dateStr = String(row[c] || '').trim();
          const rawName = String(nextRow[c] || '').trim().toUpperCase();

          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            parsedShifts.push({ dateStr, rawName });
            if (rawName && rawName !== 'NOTES:' && rawName !== '') {
              rawNamesFound.add(rawName);
            }
          }
        }
        r++; // Skip nextRow since it was parsed as names
      }
    }
  } else {
    // Heuristic 2: Tabular 2-Column Format (Date, Member)
    let dateCol = 0;
    let nameCol = 1;

    // Search header row
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
