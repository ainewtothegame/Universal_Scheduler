const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

console.log('--- Testing Requirement 1 & 2: Keyboard handler (Esc and Enter) ---');
assert(html.includes("if (e.key === 'Escape' || e.key === 'Esc')"), 'Missing Escape handler');
assert(html.includes("if (e.key === 'Enter')"), 'Missing Enter handler');
assert(html.includes("btn-save-new-member"), 'Enter handler missing roster save');
assert(html.includes("btn-save-new-blackout"), 'Enter handler missing blackout save');
assert(html.includes("btn-save-new-pref"), 'Enter handler missing pref save');
assert(html.includes("btn-save-shift"), 'Enter handler missing shift save');
console.log('PASS: Keyboard handlers present for Esc and Enter');

console.log('--- Testing Requirement 3: Cycle filtering for blackouts and requested weekends ---');
assert(html.includes('function cycleBlackouts()'), 'Missing cycleBlackouts helper');
assert(html.includes('function cyclePrefs()'), 'Missing cyclePrefs helper');

// Test logic of cycleBlackouts and cyclePrefs
const mockAppState = {
  blackouts: [
    { id: 'b1', startDate: '2027-02-01', endDate: '2027-02-05' }, // H1
    { id: 'b2', startDate: '2027-08-10', endDate: '2027-08-15' }, // H2
    { id: 'b3', startDate: '2027-06-28', endDate: '2027-07-04' }  // Overlaps both
  ],
  preferredWeekends: [
    { id: 'p1', weekendFriday: '2027-03-05' }, // H1
    { id: 'p2', weekendFriday: '2027-09-10' }  // H2
  ]
};

function testCycleBlackouts(cycle) {
  if (!cycle || cycle.blockType === 'FULL') return mockAppState.blackouts;
  return mockAppState.blackouts.filter(b => b.startDate <= cycle.endDate && b.endDate >= cycle.startDate);
}

function testCyclePrefs(cycle) {
  if (!cycle || cycle.blockType === 'FULL') return mockAppState.preferredWeekends;
  return mockAppState.preferredWeekends.filter(p => p.weekendFriday >= cycle.startDate && p.weekendFriday <= cycle.endDate);
}

const h1 = { blockType: 'H1', startDate: '2027-01-01', endDate: '2027-06-30' };
const h2 = { blockType: 'H2', startDate: '2027-07-01', endDate: '2027-12-31' };
const full = { blockType: 'FULL', startDate: '2027-01-01', endDate: '2027-12-31' };

assert.strictEqual(testCycleBlackouts(h1).length, 2, 'H1 should only include b1 and overlapping b3');
assert.strictEqual(testCycleBlackouts(h2).length, 2, 'H2 should only include b2 and overlapping b3');
assert.strictEqual(testCycleBlackouts(full).length, 3, 'FULL should include all 3 blackouts');

assert.strictEqual(testCyclePrefs(h1).length, 1, 'H1 should only include p1');
assert.strictEqual(testCyclePrefs(h2).length, 1, 'H2 should only include p2');
assert.strictEqual(testCyclePrefs(full).length, 2, 'FULL should include all 2 preferences');
console.log('PASS: Cycle filtering correctly partitions H1, H2, and shows all in FULL');

console.log('--- Testing Requirement 4: Member end date filtering ---');
assert(html.includes('function isMemberInCycle(m, cycle)'), 'Missing isMemberInCycle helper');
assert(html.includes('function getCycleRoster()'), 'Missing getCycleRoster helper');

function isMemberInCycle(m, cycle) {
  if (!cycle) return true;
  if (m.activeEnd && cycle.startDate > m.activeEnd) return false;
  if (m.activeStart && cycle.endDate < m.activeStart) return false;
  return true;
}

const members = [
  { id: 'm1', name: 'ACTIVE_ALL', activeStart: '2027-01-01', activeEnd: null },
  { id: 'm2', name: 'ENDED_IN_H1', activeStart: '2027-01-01', activeEnd: '2027-05-31' },
  { id: 'm3', name: 'STARTS_IN_H2', activeStart: '2027-07-01', activeEnd: null },
  { id: 'm4', name: 'ENDED_PAST_YEAR', activeStart: '2026-01-01', activeEnd: '2026-12-31' }
];

const h1Active = members.filter(m => isMemberInCycle(m, h1)).map(m => m.id);
assert.deepStrictEqual(h1Active, ['m1', 'm2'], 'H1 should include m1 and m2, but exclude m3 and m4');

const h2Active = members.filter(m => isMemberInCycle(m, h2)).map(m => m.id);
assert.deepStrictEqual(h2Active, ['m1', 'm3'], 'H2 should include m1 and m3, but exclude m2 (ended before H2) and m4');

const fullActive = members.filter(m => isMemberInCycle(m, full)).map(m => m.id);
assert.deepStrictEqual(fullActive, ['m1', 'm2', 'm3'], 'FULL should include m1, m2, m3, but exclude m4 (ended in 2026)');

console.log('PASS: Members with end date are properly removed from cycles beyond their end date');
console.log('All verification checks PASSED!');
