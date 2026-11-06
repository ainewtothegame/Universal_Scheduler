import assert from 'assert';
import fs from 'fs';
import { solveSchedule } from '../src/csp_solver.js';
import { evaluateScheduleConflicts } from '../src/conflict_engine.js';
import { parseCsv } from '../src/excel_engine.js';
import { StorageAdapter } from '../src/storage_adapter.js';
import * as D from '../src/domain_data.js';

const cycles = [
  { startDate: '2027-01-01', endDate: '2027-06-30', blockType: 'H1' },
  { startDate: '2027-07-01', endDate: '2027-12-31', blockType: 'H2' },
  { startDate: '2027-01-01', endDate: '2027-12-31', blockType: 'FULL' }
];

// 1. Assignments stay inside the cycle; no conflicts/diagnostics on default data
for (const c of cycles) {
  const r = solveSchedule(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const out = Object.keys(r.assignments).filter(d => d < c.startDate || d > c.endDate);
  assert.deepStrictEqual(out, [], `${c.blockType}: assignments outside cycle`);
  assert.strictEqual(Object.keys(r.diagnostics).length, 0, `${c.blockType}: diagnostics`);
  const days = (new Date(c.endDate) - new Date(c.startDate)) / 864e5 + 1;
  assert.strictEqual(Object.keys(r.assignments).length, days, `${c.blockType}: every day covered`);
  const conf = evaluateScheduleConflicts(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, r.assignments);
  const bad = Object.values(conf).flat().filter(x => x.type !== 'ATTENTION');
  assert.deepStrictEqual(bad, [], `${c.blockType}: conflicts`);
}
console.log('PASS cycle clamp + clean default schedules');

// 2. Coverage gap is reported once the schedule is non-empty
{
  const c = cycles[0];
  const r = solveSchedule(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  delete r.assignments['2027-02-10'];
  const conf = evaluateScheduleConflicts(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, r.assignments);
  assert(conf['2027-02-10'].some(x => x.code === 'UNASSIGNED_DAY'));
  const empty = evaluateScheduleConflicts(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {});
  assert.strictEqual(Object.keys(empty).length, 0);
}
console.log('PASS unassigned-day check');

// 3. Undo/redo apply to the cycle they were recorded for
{
  const s = new StorageAdapter();
  s.state = D.createInitialAppState();
  s.state.activeCycleId = '2027-H1';
  s.pushUndo();
  s.state.cycles['2027-H1'].assignments['2027-01-05'] = 'polcha';
  s.state.activeCycleId = '2027-H2';
  assert(s.undo());
  assert.strictEqual(s.state.activeCycleId, '2027-H1');
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-05'], undefined);
  assert.deepStrictEqual(s.state.cycles['2027-H2'].assignments, {});
  assert(s.redo());
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-05'], 'polcha');
}
console.log('PASS per-cycle undo/redo');

// 4. Default state does not alias shared defaults
{
  const st = D.createInitialAppState();
  st.roster[0].name = 'CHANGED';
  assert.notStrictEqual(D.DEFAULT_2027_ROSTER[0].name, 'CHANGED');
  assert.notStrictEqual(st.cycles['2027-H1'].rosterSnapshot[0].name, 'CHANGED');
}
console.log('PASS no shared references');

// 5. CSV parsing handles quotes
{
  const rows = parseCsv('﻿Date,Name\r\n2027-01-01,"DOE, JOHN"\n2027-01-02,"A ""B"""\n');
  assert.deepStrictEqual(rows, [['Date', 'Name'], ['2027-01-01', 'DOE, JOHN'], ['2027-01-02', 'A "B"']]);
}
console.log('PASS csv quoting');

// 6. Built index.html escapes user text
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('function esc('));
  assert(html.includes('${esc(m.name)}'));
}
console.log('PASS html escaping present');

// 7. Spec rules (scheduling_spec_2027.md) hold on the default full-year schedule
{
  const c = cycles[2];
  const roster = D.DEFAULT_2027_ROSTER;
  const r = solveSchedule(c, roster, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const A = r.assignments;
  const role = id => roster.find(m => m.id === id).role;
  const dow = d => new Date(d + 'T00:00:00').getDay();
  const fmt = x => { return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const plus = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return fmt(x); };

  // §2.2 alternates never work Mon-Thu except an attached holiday Monday
  const attachedMon = new Set(D.DEFAULT_2027_HOLIDAYS.filter(h => h.type === 'attached_mon').map(h => h.date));
  Object.entries(A).forEach(([d, id]) => {
    if (role(id) === 'ALT' && dow(d) >= 1 && dow(d) <= 4) assert(attachedMon.has(d), `ALT on weekday ${d}`);
  });
  // §2.3 exactly 3 alternate weekends per half each
  ['01', '07'].forEach((m, i) => {
    ['chester', 'zeiders', 'reed'].forEach(id => {
      const n = r.weekends.filter(w => A[w.saturday] === id && (w.friday.slice(5, 7) < '07') === (i === 0)).length;
      assert.strictEqual(n, 3, `${id} half ${i}: ${n}`);
    });
  });
  // §2.4 no consecutive weekends; §4 rest rule (Wed/Thu after an FT weekend)
  r.weekends.forEach((w, i) => {
    if (i && A[w.saturday] && A[w.saturday] === A[r.weekends[i - 1].saturday]) assert.fail('consecutive ' + w.friday);
    const id = A[w.saturday];
    if (!id) return; // Dec 31 weekend: Sat/Sun fall in 2028, outside the cycle
    if (role(id) === 'FT') {
      assert.notStrictEqual(A[plus(w.friday, 5)], id, 'rest Wed ' + w.friday);
      assert.notStrictEqual(A[plus(w.friday, 6)], id, 'rest Thu ' + w.friday);
    }
  });
  // §7 mandatory alternate weekends and the Feb 26 weekend restriction
  assert.strictEqual(role(A['2027-05-07']), 'ALT', 'May 7 weekend must be ALT');
  assert.strictEqual(role(A['2027-06-25']), 'ALT', 'Jun 25 weekend must be ALT');
  assert(['terek', 'kemerer', 'chester', 'zeiders', 'reed'].includes(A['2027-02-26']), 'Feb 26 weekend');
  // §3 holiday rules: attached Mondays/Fridays go with the weekend worker
  D.DEFAULT_2027_HOLIDAYS.filter(h => h.type === 'attached_mon').forEach(h => {
    assert.strictEqual(A[h.date], A[plus(h.date, -1)], 'attached Monday ' + h.date);
  });
  D.DEFAULT_2027_HOLIDAYS.filter(h => h.type === 'attached_fri').forEach(h => {
    assert.strictEqual(A[h.date], A[plus(h.date, 1)], 'attached Friday ' + h.date);
  });
  // §2.1 KEMERER not scheduled from Mar 1
  Object.entries(A).forEach(([d, id]) => { if (id === 'kemerer') assert(d <= '2027-02-28', 'kemerer ' + d); });
  // §6 blackouts respected
  D.DEFAULT_2027_BLACKOUTS.forEach(b => {
    Object.entries(A).forEach(([d, id]) => { if (id === b.memberId) assert(!(d >= b.startDate && d <= b.endDate), `blackout ${id} ${d}`); });
  });
}
console.log('PASS spec rules on default schedule');

// 8. Backtracking rescues a case the greedy pass cannot: greedy picks A for weekend 1,
// then weekend 2 has nobody (A would be back-to-back, B is blacked out). Only B,A,B works.
{
  const roster = [
    { id: 'a', name: 'A', role: 'FT', activeStart: '2027-03-01', activeEnd: null, baselineWeekday: null },
    { id: 'b', name: 'B', role: 'FT', activeStart: '2027-03-01', activeEnd: null, baselineWeekday: null }
  ];
  const bl = [{ id: 'x', memberId: 'b', startDate: '2027-03-12', endDate: '2027-03-15', notes: '' }];
  const r = solveSchedule({ startDate: '2027-03-05', endDate: '2027-03-21', blockType: 'H1' }, roster, bl, [], {}, []);
  assert.deepStrictEqual(Object.keys(r.diagnostics).filter(k => /Deadlock/.test(r.diagnostics[k])), []);
  assert.deepStrictEqual(r.weekends.map(w => r.assignments[w.saturday]), ['b', 'a', 'b']);
}
console.log('PASS ft weekend backtracking');

// 9. Unreadable saved state is preserved, not silently overwritten
{
  const store = { psp_fire_marshal_schedule_v1: '{"version":2,"cycles":{}}' };
  globalThis.window = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  const s = new StorageAdapter();
  assert.strictEqual(store.psp_fire_marshal_schedule_v1_unreadable_backup, '{"version":2,"cycles":{}}');
  assert.strictEqual(s.state.version, 1);
  store.psp_fire_marshal_schedule_v1 = '{not json';
  new StorageAdapter();
  assert.strictEqual(store.psp_fire_marshal_schedule_v1_unreadable_backup, '{not json');
  delete globalThis.window;
}
console.log('PASS unreadable state preserved');
