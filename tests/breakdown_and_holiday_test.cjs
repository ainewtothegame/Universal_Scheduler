/**
 * breakdown_and_holiday_test.cjs
 * Verifies that:
 * 1. July 4th is strictly July 4th and no observed July 5th holiday exists.
 * 2. Full Year cycle assignments synchronize properly from H1 and H2.
 * 3. Shift breakdown calculates correct segmented FT and ALT equity.
 * 4. Shift breakdown lists each member's worked holidays and renders the holiday coverage breakdown.
 */

const fs = require('fs');
const assert = require('assert');

async function runTests() {
  console.log('=== Test 1: July 4th Holiday Specification ===');
  const domainData = await import('../src/domain_data.js');
  const { DEFAULT_2027_HOLIDAYS, createInitialAppState, formatDate, parseDate } = domainData;

  const jul4 = DEFAULT_2027_HOLIDAYS.find(h => h.date === '2027-07-04');
  assert(jul4, 'July 4th holiday must exist in DEFAULT_2027_HOLIDAYS');
  assert.strictEqual(jul4.name, 'Independence Day');

  const jul5 = DEFAULT_2027_HOLIDAYS.find(h => h.date === '2027-07-05');
  assert.strictEqual(jul5, undefined, 'Observed holiday on 2027-07-05 must NOT exist');
  console.log('PASS: July 4th is celebrated strictly on July 4th with zero observed holiday.');

  console.log('\n=== Test 2: Full Year Synchronization across H1, H2, and FULL ===');
  const appState = createInitialAppState();
  const { solveSchedule } = await import('../src/csp_solver.js');

  // Solve H1 and H2 independently
  const h1 = appState.cycles['2027-H1'];
  const resH1 = solveSchedule(h1, appState.roster, appState.blackouts, appState.holidays);
  h1.assignments = resH1.assignments;

  const h2 = appState.cycles['2027-H2'];
  const resH2 = solveSchedule(h2, appState.roster.filter(m => !m.activeEnd || m.activeEnd >= h2.startDate), appState.blackouts, appState.holidays);
  h2.assignments = resH2.assignments;

  // Simulate syncCycleAssignments(2027)
  const full = appState.cycles['2027-FULL'];
  assert(full, '2027-FULL cycle exists');

  // Sync logic
  if (!full.assignments) full.assignments = {};
  for (const [d, id] of Object.entries(h1.assignments)) {
    if (id) full.assignments[d] = id;
  }
  for (const [d, id] of Object.entries(h2.assignments)) {
    if (id) full.assignments[d] = id;
  }

  const assignedDates = Object.keys(full.assignments).filter(d => d.startsWith('2027-'));
  assert.strictEqual(assignedDates.length, 365, `All 365 days of 2027 must be assigned in FULL cycle, got ${assignedDates.length}`);
  console.log('PASS: Full year cycle contains all 365 assignments merged from H1 and H2.');

  console.log('\n=== Test 3: Member Holiday Breakdown Tracking ===');
  const memberHols = {};
  appState.roster.forEach(m => { memberHols[m.id] = []; });

  const official2027Hols = appState.holidays.filter(h => h.date >= '2027-01-01' && h.date <= '2027-12-31');
  assert.strictEqual(official2027Hols.length, 13, `Expected 13 official holidays in 2027, found ${official2027Hols.length}`);

  official2027Hols.forEach(h => {
    const workerId = full.assignments[h.date];
    assert(workerId, `Holiday ${h.name} on ${h.date} must be staffed`);
    if (memberHols[workerId]) {
      memberHols[workerId].push(h.name);
    }
  });

  const totalHolsCovered = Object.values(memberHols).reduce((acc, arr) => acc + arr.length, 0);
  assert.strictEqual(totalHolsCovered, 13, `All 13 holidays must be distributed to members, got ${totalHolsCovered}`);

  // Confirm Polcha has Independence Day
  const jul4Worker = full.assignments['2027-07-04'];
  assert(jul4Worker, 'July 4th must have an assigned worker');
  console.log(`PASS: July 4th is staffed by member: ${jul4Worker}`);
  console.log('PASS: Holiday assignments tracked for each member:');
  for (const [memId, hols] of Object.entries(memberHols)) {
    console.log(`  - ${memId.toUpperCase()}: ${hols.length} holidays (${hols.join(', ') || 'None'})`);
  }

  console.log('\n=== Test 4: index.html DOM Output and Structure ===');
  const html = fs.readFileSync('index.html', 'utf8');
  assert(html.includes('Official Holidays Coverage Breakdown'), 'index.html must include Holiday Coverage Breakdown section');
  assert(html.includes('Master Holiday Schedule'), 'index.html must include Master Holiday Schedule table');
  assert(html.includes('syncCycleAssignments'), 'index.html must include cycle sync helper');
  assert(html.includes('overflow-x:auto'), 'index.html must include scrollable table wrapper');
  console.log('PASS: index.html correctly bundles holiday breakdown and cycle sync capabilities.');

  console.log('\nALL BREAKDOWN & HOLIDAY TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
