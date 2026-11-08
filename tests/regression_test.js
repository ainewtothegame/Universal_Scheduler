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

// 10. Requested-weekend dropdown hides taken weekends; roster shows scheduled counts
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('function refreshPrefWeekendSelect'));
  assert(html.includes('.filter(w => !taken.has(w.friday))'));
  assert(html.includes('scheduled'));
}
console.log('PASS requested-weekend filter + scheduled counts present');

// 11. Investigator dropdown shows scheduled/requested counts for alternates
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('function refreshPrefMemberSelect'));
  assert(html.includes(' scheduled${requested'));
}
console.log('PASS investigator dropdown counts present');

// 12. Requested weekends are ALWAYS honored (blackouts first, requests second, then fill).
// If the requests use all alternate quota, the spec §7 weekends (May 7-9, Jun 25-27) cannot get an
// Alternate: the solver must keep every request and tell the user instead of dropping a request.
{
  const roster = D.DEFAULT_2027_ROSTER;
  const req = (memberId, weekendFriday) => ({ id: memberId + weekendFriday, memberId, weekendFriday, notes: '' });
  const prefs = [
    req('chester', '2027-04-02'), req('zeiders', '2027-01-22'), req('zeiders', '2027-02-19'),
    req('zeiders', '2027-04-16'), req('chester', '2027-02-05'), req('chester', '2027-06-11'),
    req('reed', '2027-02-26'), req('reed', '2027-05-21'), req('reed', '2027-04-23')
  ];
  const c = cycles[0];
  const r = solveSchedule(c, roster, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, prefs);
  prefs.forEach(p => {
    const w = r.weekends.find(x => x.friday === p.weekendFriday);
    assert.strictEqual(r.assignments[w.saturday], p.memberId, `request honored ${p.weekendFriday}`);
  });
  assert.deepStrictEqual(r.preferenceWarnings, [], 'no request skipped');
  assert.strictEqual(r.scheduleNotices.length, 2, 'both spec §7 weekends reported');
  assert(r.scheduleNotices.some(n => n.includes('2027-05-07')) && r.scheduleNotices.some(n => n.includes('2027-06-25')));
  assert(r.scheduleNotices.every(n => /ask an Alternate/i.test(n)));

  // With room in the quota (one request fewer per alternate) the required weekends DO get an Alternate
  const fewer = prefs.filter(p => !['2027-04-16', '2027-06-11', '2027-04-23'].includes(p.weekendFriday));
  const r2 = solveSchedule(c, roster, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, fewer);
  assert.strictEqual(r2.scheduleNotices.length, 0);
  assert.strictEqual(role(r2.assignments['2027-05-07']), 'ALT');
  assert.strictEqual(role(r2.assignments['2027-06-25']), 'ALT');
  fewer.forEach(p => {
    const w = r2.weekends.find(x => x.friday === p.weekendFriday);
    assert.strictEqual(r2.assignments[w.saturday], p.memberId, 'still honored ' + p.weekendFriday);
  });
  function role(id) { return roster.find(m => m.id === id).role; }
}
console.log('PASS requests honored first; spec §7 conflicts reported');

// 12b. A request that falls in a blackout is the only thing skipped (blackouts come first)
{
  const prefs = [{ id: 'x', memberId: 'polcha', weekendFriday: '2027-01-15', notes: '' }]; // POLCHA off Jan 16-17
  const r = solveSchedule(cycles[0], D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, prefs);
  assert(r.preferenceWarnings.some(w => /blackout/.test(w)));
  assert.notStrictEqual(r.assignments['2027-01-16'], 'polcha');
}
console.log('PASS blackout beats request');

// 13. Legacy boolean manual-override flags never become a "member"
{
  const c = cycles[0];
  const r = solveSchedule(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, { '2027-03-02': true, '2027-03-09': 'terek' }, []);
  assert.notStrictEqual(r.assignments['2027-03-02'], true);
  assert(typeof r.assignments['2027-03-02'] === 'string');
  assert.strictEqual(r.assignments['2027-03-09'], 'terek');
}
console.log('PASS manual override flags');

// 14. Soft preference: an FT who works the coming Fri-Mon weekend does not also take the Thursday before it
{
  const plus = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  for (const c of cycles) {
    const r = solveSchedule(c, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
    const bad = r.weekends.filter(w => {
      const who = r.assignments[w.friday];
      return who && r.assignments[plus(w.friday, -1)] === who && D.DEFAULT_2027_ROSTER.find(m => m.id === who).role === 'FT';
    }).map(w => w.friday);
    assert.deepStrictEqual(bad, [], `${c.blockType}: Thursday before own weekend`);
  }
  // ...and weekday load stays balanced among the full-year FTs
  const r = solveSchedule(cycles[2], D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const cnt = { polcha: 0, terek: 0, wolfe: 0 };
  Object.entries(r.assignments).forEach(([d, id]) => {
    const dw = new Date(d + 'T00:00:00').getDay();
    if (dw >= 1 && dw <= 4 && cnt[id] !== undefined) cnt[id]++;
  });
  const v = Object.values(cnt);
  assert(Math.max(...v) - Math.min(...v) <= 3, 'weekday balance ' + JSON.stringify(cnt));
}
console.log('PASS Thursday-before-own-weekend preference');

// 15. Week leading into a full-timer's own weekend (Phase 2): Tue other, Wed = weekend worker, Thu other
{
  const plus = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const r = solveSchedule(cycles[2], D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const A = r.assignments;
  let held = 0, total = 0;
  r.weekends.forEach(w => {
    if (w.phase !== 2) return;
    const W = A[w.friday];
    if (!W || D.DEFAULT_2027_ROSTER.find(m => m.id === W).role !== 'FT') return;
    total++;
    const ok = A[plus(w.friday, -2)] === W && A[plus(w.friday, -3)] !== W && A[plus(w.friday, -1)] !== W;
    if (ok) held++;
  });
  assert(held >= total - 3, `pattern held ${held}/${total}`); // soft preference: a few weeks may lose to load balance
}
console.log('PASS Tue other / Wed weekend worker / Thu other pattern');

// 16. Alternates are spread out: not in consecutive weeks, at most one weekend per month (when nothing forces more)
{
  const r = solveSchedule(cycles[2], D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const A = r.assignments;
  const isAlt = id => id && D.DEFAULT_2027_ROSTER.find(m => m.id === id).role === 'ALT';
  const perMonth = {};
  r.weekends.forEach((w, i) => {
    const id = A[w.saturday];
    if (!isAlt(id)) return;
    const next = r.weekends[i + 1] && A[r.weekends[i + 1].saturday];
    assert(!isAlt(next), `alternates back-to-back at ${w.friday}`);
    const k = id + w.friday.slice(0, 7);
    perMonth[k] = (perMonth[k] || 0) + 1;
    assert(perMonth[k] <= 1, `${id} twice in ${w.friday.slice(0, 7)}`);
  });
  // Each alternate's own weekends are at least a month apart (4+ weekends)
  ['chester', 'zeiders', 'reed'].forEach(id => {
    const idx = r.weekends.map((w, i) => A[w.saturday] === id ? i : -1).filter(i => i >= 0);
    for (let i = 1; i < idx.length; i++) assert(idx[i] - idx[i - 1] >= 4, `${id} gap ${idx[i] - idx[i - 1]}`);
  });
}
console.log('PASS alternates spread out');

// 17. Holidays are shared among Full-Time members (last consideration; weekend counts stay even)
{
  const roster = D.DEFAULT_2027_ROSTER;
  const r = solveSchedule(cycles[2], roster, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  const A = r.assignments;
  const weight = {};
  ['polcha', 'terek', 'wolfe'].forEach(id => { weight[id] = 0; });
  D.DEFAULT_2027_HOLIDAYS.forEach(h => {
    const id = A[h.date];
    if (weight[id] !== undefined) weight[id] += D.isPremiumHoliday(h) ? 1 : 0.5;
  });
  const v = Object.values(weight);
  assert(Math.max(...v) - Math.min(...v) <= 1.5, 'holiday spread ' + JSON.stringify(weight)); // was 5.5 before balancing
  const wk = { polcha: 0, terek: 0, wolfe: 0 };
  r.weekends.forEach(w => { if (wk[A[w.saturday]] !== undefined) wk[A[w.saturday]]++; });
  const wv = Object.values(wk);
  assert(Math.max(...wv) - Math.min(...wv) <= 1, 'weekend spread ' + JSON.stringify(wk));
  // Holiday balance never overrides a hard rule: all spec rules were re-verified separately in test 7
}
console.log('PASS holiday balance');

// 18. Clear Calendar wipes selected calendar with sibling sync and undo/redo support
{
  const s = new StorageAdapter();
  s.state = D.createInitialAppState();
  s.state.activeCycleId = '2027-H1';
  s.state.cycles['2027-H1'].assignments = { '2027-01-05': 'polcha', '2027-01-06': 'terek' };
  s.state.cycles['2027-H1'].manualOverrides = { '2027-01-05': true };
  s.state.cycles['2027-FULL'].assignments = { '2027-01-05': 'polcha', '2027-01-06': 'terek', '2027-08-10': 'wolfe' };
  s.state.cycles['2027-H2'].assignments = { '2027-08-10': 'wolfe' };

  // Clear H1
  assert(s.clearCycle('2027-H1'));
  assert.deepStrictEqual(s.state.cycles['2027-H1'].assignments, {});
  assert.deepStrictEqual(s.state.cycles['2027-H1'].manualOverrides, {});
  // H1 dates removed from FULL, H2 dates preserved in FULL and H2
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-01-05'], undefined);
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-01-06'], undefined);
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-08-10'], 'wolfe');
  assert.strictEqual(s.state.cycles['2027-H2'].assignments['2027-08-10'], 'wolfe');

  // Undo restores H1 assignments
  assert(s.undo());
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-05'], 'polcha');
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-06'], 'terek');
  assert.strictEqual(s.state.cycles['2027-H1'].manualOverrides['2027-01-05'], true);

  // Redo wipes H1 again and clears from FULL
  assert(s.redo());
  assert.deepStrictEqual(s.state.cycles['2027-H1'].assignments, {});
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-01-05'], undefined);

  // Test clearing FULL wipes all sibling cycles for that year
  s.state.cycles['2027-FULL'].assignments = { '2027-01-10': 'polcha', '2027-09-15': 'terek' };
  s.state.cycles['2027-H1'].assignments = { '2027-01-10': 'polcha' };
  s.state.cycles['2027-H2'].assignments = { '2027-09-15': 'terek' };
  assert(s.clearCycle('2027-FULL'));
  assert.deepStrictEqual(s.state.cycles['2027-FULL'].assignments, {});
  assert.deepStrictEqual(s.state.cycles['2027-H1'].assignments, {});
  assert.deepStrictEqual(s.state.cycles['2027-H2'].assignments, {});
}
console.log('PASS clear calendar engine and undo/redo');

// 19. Built index.html contains clear calendar button, confirmation prompt, and handler
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('id="btn-clear-calendar"'), 'missing btn-clear-calendar element');
  assert(html.includes('Clear Calendar'), 'missing Clear Calendar text');
  assert(html.includes('storage.clearCycle('), 'missing storage.clearCycle call');
  assert(html.includes('confirm('), 'missing confirmation prompt');
}
console.log('PASS clear calendar UI elements and confirmation prompt present');
