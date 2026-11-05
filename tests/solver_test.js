/**
 * solver_test.js
 * Node-based automated unit test runner for the 5-Stage Stratified CSP Solver.
 */

import { createInitialAppState, parseDate, formatDate, addDays, getDayOfWeek } from '../src/domain_data.js';
import { solveSchedule, identifyWeekends } from '../src/csp_solver.js';

console.log('================================================================');
console.log('Running PSP Fire Marshal 5-Stage Stratified CSP Solver Tests');
console.log('================================================================\n');

const appState = createInitialAppState();
const cycleH1 = appState.cycles['2027-H1'];
const roster = appState.roster;
const blackouts = appState.blackouts;
const holidays = appState.holidays;

const startTime = performance.now();
const result = solveSchedule(cycleH1, roster, blackouts, holidays);
const durationMs = (performance.now() - startTime).toFixed(2);

console.log(`Solver executed in ${durationMs} ms.\n`);

const weekends = result.weekends;
const assignments = result.assignments;
const diagnostics = result.diagnostics;

let passedTests = 0;
let totalTests = 0;

function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${description}`);
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${description}`);
    if (details) console.error(`       Details: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// Test 1: 100% Shift Coverage (Zero Unassigned Days in 2027 H1)
// -----------------------------------------------------------------------------
let unassignedDays = [];
let curr = parseDate(cycleH1.startDate);
const end = parseDate(cycleH1.endDate);
let totalDays = 0;

while (curr <= end) {
  totalDays++;
  const dateStr = formatDate(curr);
  if (!assignments[dateStr]) {
    unassignedDays.push(dateStr);
  }
  curr.setDate(curr.getDate() + 1);
}

assert(
  `100% Shift Coverage in H1 (181/181 days assigned)`,
  unassignedDays.length === 0,
  `Unassigned dates: ${unassignedDays.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 2: Post-Weekend Compensatory Rest Invariant (Zero Rest Violations)
// -----------------------------------------------------------------------------
// If an FT member worked Weekend W, they cannot work Wed or Thu of Week W+1
let restViolations = [];
weekends.forEach(w => {
  const satWorkerId = assignments[w.saturday];
  const worker = roster.find(m => m.id === satWorkerId);
  if (worker && worker.role === 'FT') {
    // Next week's Wednesday and Thursday
    const wedStr = formatDate(addDays(w.friday, 5));
    const thuStr = formatDate(addDays(w.friday, 6));

    if (assignments[wedStr] === worker.id) {
      restViolations.push(`${worker.name} worked weekend ${w.friday} and also Wed ${wedStr}`);
    }
    if (assignments[thuStr] === worker.id) {
      restViolations.push(`${worker.name} worked weekend ${w.friday} and also Thu ${thuStr}`);
    }
  }
});

assert(
  `Zero Post-Weekend Rest Violations across all H1 days`,
  restViolations.length === 0,
  restViolations.join('; ')
);

// -----------------------------------------------------------------------------
// Test 3: Exact Alternate Weekend Quotas (Exactly 3 per Alternate in H1)
// -----------------------------------------------------------------------------
const altWeekendCounts = { chester: 0, zeiders: 0, reed: 0 };
weekends.forEach(w => {
  const workerId = assignments[w.saturday];
  if (altWeekendCounts[workerId] !== undefined) {
    altWeekendCounts[workerId]++;
  }
});

const allAltQuotasExact =
  altWeekendCounts.chester === 3 &&
  altWeekendCounts.zeiders === 3 &&
  altWeekendCounts.reed === 3;

assert(
  `Exact Alternate Weekend Quotas in H1 (3 each for Chester, Zeiders, Reed; 9 total)`,
  allAltQuotasExact,
  `Actual counts: Chester=${altWeekendCounts.chester}, Zeiders=${altWeekendCounts.zeiders}, Reed=${altWeekendCounts.reed}`
);

// -----------------------------------------------------------------------------
// Test 4: Strict Prohibition of Consecutive Weekends
// -----------------------------------------------------------------------------
let consecutiveWeekendViolations = [];
for (let i = 0; i < weekends.length - 1; i++) {
  const w1 = weekends[i];
  const w2 = weekends[i + 1];
  const worker1 = assignments[w1.saturday];
  const worker2 = assignments[w2.saturday];

  if (worker1 && worker2 && worker1 === worker2) {
    const mem = roster.find(m => m.id === worker1);
    consecutiveWeekendViolations.push(`${mem?.name || worker1} worked consecutive weekends ${w1.friday} and ${w2.friday}`);
  }
}

assert(
  `Zero Consecutive Weekends across all personnel in H1`,
  consecutiveWeekendViolations.length === 0,
  consecutiveWeekendViolations.join('; ')
);

// -----------------------------------------------------------------------------
// Test 5: Proactive Lookahead Satisfaction Prior to FT Vacation Weeks
// -----------------------------------------------------------------------------
// Rule 1: Weekend of May 7–9, 2027 (Prior to Wolfe's May 10–14 Leave) MUST be an Alternate
const may7WorkerId = assignments['2027-05-08'];
const may7Worker = roster.find(m => m.id === may7WorkerId);
const isMay7Alt = may7Worker && may7Worker.role === 'ALT';

// Rule 2: Weekend of Jun 25–27, 2027 (Prior to/Start of Terek's Leave) MUST be an Alternate
const jun25WorkerId = assignments['2027-06-26'];
const jun25Worker = roster.find(m => m.id === jun25WorkerId);
const isJun25Alt = jun25Worker && jun25Worker.role === 'ALT';

assert(
  `Proactive Lookahead Alternate placed on May 7–9 (prior to Wolfe leave)`,
  isMay7Alt,
  `Assigned: ${may7Worker?.name} (Role: ${may7Worker?.role})`
);

assert(
  `Proactive Lookahead Alternate placed on Jun 25–27 (start of Terek leave)`,
  isJun25Alt,
  `Assigned: ${jun25Worker?.name} (Role: ${jun25Worker?.role})`
);

// -----------------------------------------------------------------------------
// Test 6: Zero Blackout Clashes
// -----------------------------------------------------------------------------
let blackoutClashes = [];
Object.entries(assignments).forEach(([dateStr, memberId]) => {
  const mem = roster.find(m => m.id === memberId);
  const isBlacked = blackouts.some(b => b.memberId === memberId && dateStr >= b.startDate && dateStr <= b.endDate);
  if (isBlacked) {
    blackoutClashes.push(`${mem?.name || memberId} assigned on blacked out date ${dateStr}`);
  }
});

assert(
  `Zero Blackout Clashes across all assignments`,
  blackoutClashes.length === 0,
  blackoutClashes.join('; ')
);

// -----------------------------------------------------------------------------
// Test 7: Solver Performance (< 50ms threshold)
// -----------------------------------------------------------------------------
assert(
  `Solver Performance under 50ms (${durationMs} ms)`,
  parseFloat(durationMs) < 50
);

// -----------------------------------------------------------------------------
// Final Summary Table
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedTests}/${totalTests} Tests Passed.`);
if (passedTests === totalTests) {
  console.log('ALL INVARIANTS SATISFIED! Ready for Milestone 3 & 4.');
} else {
  console.error('FAILURES DETECTED! Review details above.');
}
console.log('================================================================\n');

// Weekend Assignment Summary Table
console.log('2027 H1 Weekend Assignments:');
console.table(
  weekends.map(w => ({
    Weekend: `${w.friday} to ${w.sunday}`,
    Worker: roster.find(m => m.id === assignments[w.saturday])?.name,
    Role: roster.find(m => m.id === assignments[w.saturday])?.role,
    AttachedHol: w.attachedMonday || w.attachedFriday || '-'
  }))
);
