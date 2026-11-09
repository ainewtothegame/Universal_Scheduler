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
    rank: 'Trooper',
    firstName: 'Sean',
    name: 'POLCHA',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 1, // Monday
    color: '#1e3a8a'    // Deep Blue
  },
  {
    id: 'terek',
    rank: 'Trooper',
    firstName: 'Cory',
    name: 'TEREK',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 4, // Thursday
    color: '#047857'    // Emerald Green
  },
  {
    id: 'wolfe',
    rank: 'Trooper',
    firstName: 'Jonathon',
    name: 'WOLFE',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: null,
    baselineWeekday: 3, // Wednesday
    color: '#b45309'    // Amber Brown
  },
  {
    id: 'kemerer',
    rank: 'Trooper',
    firstName: 'Ryan',
    name: 'KEMERER',
    role: 'FT',
    activeStart: '2027-01-01',
    activeEnd: '2027-02-28', // Transfers end of Feb 2027
    baselineWeekday: 2,     // Tuesday (Phase 1)
    color: '#0f766e'        // Teal
  },
  {
    id: 'chester',
    rank: 'Trooper',
    firstName: 'Matthew',
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
    rank: 'Trooper',
    firstName: 'Adam',
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
    rank: 'Trooper',
    firstName: 'Cody',
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

// Format Weekend On-Call Range for Printing: "Month xx-xx" (e.g. "July 4-6", "May 3-6", "August 4-7", "May 28-31")
export function formatWeekendPrintDate(w, cycleAssignments) {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const workerId = cycleAssignments ? cycleAssignments[w.saturday] : null;

  // Determine start date (include attached Friday if assigned to this worker)
  let startStr = w.friday;
  if (w.attachedFriday && workerId && cycleAssignments[w.attachedFriday] === workerId) {
    startStr = w.attachedFriday;
  }
  // Determine end date (include attached Monday if assigned to this worker)
  let endStr = w.sunday;
  if (w.attachedMonday && workerId && cycleAssignments[w.attachedMonday] === workerId) {
    endStr = w.attachedMonday;
  }

  const startDate = parseDate(startStr);
  const endDate = parseDate(endStr);

  const startMonth = MONTH_NAMES[startDate.getMonth()];
  const endMonth = MONTH_NAMES[endDate.getMonth()];
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

// Format Member Print Name: "Trooper Sean POLCHA", "Trooper Ryan KEMERER", etc.
export function getMemberPrintName(mem) {
  if (!mem) return 'UNASSIGNED';
  const rank = (mem.rank || 'Trooper').trim();
  const firstName = (mem.firstName || '').trim();
  const lastName = (mem.name || '').trim();
  if (firstName) {
    return `${rank} ${firstName} ${lastName}`.trim();
  }
  return `${rank} ${lastName}`.trim();
}

// Deep copy so state never aliases the shared defaults (or other cycles' snapshots)
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// Initial AppState factory
export function createInitialAppState() {
  return {
    version: 1,
    roster: clone(DEFAULT_2027_ROSTER),
    blackouts: clone(DEFAULT_2027_BLACKOUTS),
    preferredWeekends: [], // { id, memberId, weekendFriday, notes }
    holidays: clone(DEFAULT_2027_HOLIDAYS),
    pinnedNotes: [], // { id, cycleId, cycleName, title, date, content, switchSuggestions }
    cycles: {
      '2027-H1': {
        id: '2027-H1',
        year: 2027,
        blockType: 'H1',
        startDate: '2027-01-01',
        endDate: '2027-06-30',
        rosterSnapshot: clone(DEFAULT_2027_ROSTER),
        blackoutsSnapshot: clone(DEFAULT_2027_BLACKOUTS),
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
        rosterSnapshot: clone(DEFAULT_2027_ROSTER),
        blackoutsSnapshot: clone(DEFAULT_2027_BLACKOUTS),
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
        rosterSnapshot: clone(DEFAULT_2027_ROSTER),
        blackoutsSnapshot: clone(DEFAULT_2027_BLACKOUTS),
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
