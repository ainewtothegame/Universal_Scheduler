/**
 * domain_data.js
 * Default domain data and date utilities for Pennsylvania State Police (PSP) Fire Marshal Scheduling.
 */

// Helper: Format date as 'YYYY-MM-DD'
export function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Parse 'YYYY-MM-DD' to Date at local midnight
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Helper: Add days
export function addDays(dateOrStr, days) {
  const d = typeof dateOrStr === 'string' ? parseDate(dateOrStr) : new Date(dateOrStr.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// Helper: Day of week (0=Sun, 1=Mon, ..., 6=Sat)
export function getDayOfWeek(dateOrStr) {
  const d = typeof dateOrStr === 'string' ? parseDate(dateOrStr) : dateOrStr;
  return d.getDay();
}

// Default 2027 Roster
export const DEFAULT_2027_ROSTER = [
  {
    id: 'polcha',
    name: 'POLCHA',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 1, // Monday
    color: '#1e3a8a'    // Deep Blue
  },
  {
    id: 'terek',
    name: 'TEREK',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 4, // Thursday
    color: '#047857'    // Emerald Green
  },
  {
    id: 'wolfe',
    name: 'WOLFE',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 3, // Wednesday
    color: '#b45309'    // Amber Brown
  },
  {
    id: 'kemerer',
    name: 'KEMERER',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: '2027-02-28', // Transfers end of Feb 2027
    baselineWeekday: 2,     // Tuesday (Phase 1)
    color: '#0f766e'        // Teal
  },
  {
    id: 'chester',
    name: 'CHESTER',
    role: 'ALT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: null,
    weekendsPerSixMonths: 3,
    color: '#6d28d9'        // Purple
  },
  {
    id: 'zeiders',
    name: 'ZEIDERS',
    role: 'ALT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: null,
    weekendsPerSixMonths: 3,
    color: '#be185d'        // Pink/Rose
  },
  {
    id: 'reed',
    name: 'REED',
    role: 'ALT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: null,
    weekendsPerSixMonths: 3,
    color: '#c2410c'        // Orange
  }
];

// Historical Inactive Members (for alias reconciliation)
export const HISTORICAL_MEMBERS = [
  {
    id: 'keebaugh',
    name: 'KEEBAUGH',
    role: 'FT',
    activeStart: '2026-01-01',
    activeEnd: '2027-01-03',
    baselineWeekday: null,
    color: '#64748b'
  },
  {
    id: 'riley',
    name: 'RILEY',
    role: 'FT',
    activeStart: '2027-05-31',
    activeEnd: '2027-05-31',
    baselineWeekday: null,
    color: '#475569'
  }
];

// Premium holidays per the Enlisted Leave Tracker: every official holiday EXCEPT
// Martin Luther King Day, Presidents' Day and General Election Day.
const NON_PREMIUM_HOLIDAY_NAMES = ['Martin Luther King Day', "Presidents' Day", 'General Election Day'];

// Name-based so it also works for holidays saved in the browser before this flag existed.
export function isPremiumHoliday(holiday) {
  return !NON_PREMIUM_HOLIDAY_NAMES.includes(holiday.name);
}
// Official 2027 Enlisted Holidays
export const DEFAULT_2027_HOLIDAYS = [
  { date: '2027-01-01', year: 2027, name: "New Year's Day", type: 'attached_fri' },
  { date: '2027-01-18', year: 2027, name: 'Martin Luther King Day', type: 'attached_mon' },
  { date: '2027-02-15', year: 2027, name: "Presidents' Day", type: 'attached_mon' },
  { date: '2027-03-26', year: 2027, name: 'Good Friday', type: 'attached_fri' },
  { date: '2027-05-31', year: 2027, name: 'Memorial Day', type: 'attached_mon' },
  { date: '2027-06-19', year: 2027, name: 'Juneteenth', type: 'weekend' },
  { date: '2027-07-04', year: 2027, name: 'Independence Day', type: 'weekend' },
  { date: '2027-09-06', year: 2027, name: 'Labor Day', type: 'attached_mon' },
  { date: '2027-10-11', year: 2027, name: 'Columbus Day', type: 'attached_mon' },
  { date: '2027-11-02', year: 2027, name: 'General Election Day', type: 'midweek' },
  { date: '2027-11-11', year: 2027, name: 'Veterans Day', type: 'midweek' },
  { date: '2027-11-25', year: 2027, name: 'Thanksgiving Day', type: 'midweek' },
  { date: '2027-12-25', year: 2027, name: 'Christmas Day', type: 'weekend' }
];

// Baseline 2027 Blackouts from Specification
export const DEFAULT_2027_BLACKOUTS = [
  // Polcha
  { id: 'b_polcha_1', memberId: 'polcha', startDate: '2027-01-16', endDate: '2027-01-17', notes: 'Weekend leave' },
  { id: 'b_polcha_2', memberId: 'polcha', startDate: '2027-01-30', endDate: '2027-01-31', notes: 'Weekend leave' },
  { id: 'b_polcha_3', memberId: 'polcha', startDate: '2027-02-11', endDate: '2027-02-15', notes: 'Presidents Day weekend' },
  { id: 'b_polcha_4', memberId: 'polcha', startDate: '2027-02-27', endDate: '2027-02-28', notes: 'Weekend leave' },
  { id: 'b_polcha_5', memberId: 'polcha', startDate: '2027-12-24', endDate: '2027-12-27', notes: 'Christmas weekend' },

  // Wolfe
  { id: 'b_wolfe_1', memberId: 'wolfe', startDate: '2027-02-22', endDate: '2027-02-26', notes: 'Full week vacation' },
  { id: 'b_wolfe_2', memberId: 'wolfe', startDate: '2027-05-10', endDate: '2027-05-14', notes: 'Full week vacation' },

  // Terek
  { id: 'b_terek_1', memberId: 'terek', startDate: '2027-03-26', endDate: '2027-03-27', notes: 'Good Friday / Easter' },
  { id: 'b_terek_2', memberId: 'terek', startDate: '2027-05-28', endDate: '2027-05-28', notes: 'Memorial Day weekend' },
  { id: 'b_terek_3', memberId: 'terek', startDate: '2027-06-26', endDate: '2027-07-03', notes: 'Summer vacation' }
];

// Initial AppState factory
export function createInitialAppState() {
  return {
    version: 1,
    roster: [...DEFAULT_2027_ROSTER],
    blackouts: [...DEFAULT_2027_BLACKOUTS],
    preferredWeekends: [], // { id, memberId, weekendFriday, notes }
    holidays: [...DEFAULT_2027_HOLIDAYS],
    cycles: {
      '2027-H1': {
        id: '2027-H1',
        year: 2027,
        blockType: 'H1',
        startDate: '2027-01-01',
        endDate: '2027-06-30',
        rosterSnapshot: [...DEFAULT_2027_ROSTER],
        blackoutsSnapshot: [...DEFAULT_2027_BLACKOUTS],
        assignments: {},
        manualOverrides: {},
        solverDiagnostics: {},
        updatedAt: Date.now()
      },
      '2027-H2': {
        id: '2027-H2',
        year: 2027,
        blockType: 'H2',
        startDate: '2027-07-01',
        endDate: '2027-12-31',
        rosterSnapshot: [...DEFAULT_2027_ROSTER],
        blackoutsSnapshot: [...DEFAULT_2027_BLACKOUTS],
        assignments: {},
        manualOverrides: {},
        solverDiagnostics: {},
        updatedAt: Date.now()
      },
      '2027-FULL': {
        id: '2027-FULL',
        year: 2027,
        blockType: 'FULL',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        rosterSnapshot: [...DEFAULT_2027_ROSTER],
        blackoutsSnapshot: [...DEFAULT_2027_BLACKOUTS],
        assignments: {},
        manualOverrides: {},
        solverDiagnostics: {},
        updatedAt: Date.now()
      }
    },
    activeCycleId: '2027-H1',
    savedSnapshots: {}
  };
}
