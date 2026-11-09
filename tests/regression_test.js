import assert from 'assert';
import fs from 'fs';
import { solveSchedule, identifyWeekends } from '../src/csp_solver.js';
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
  assert(html.includes('storage.clearMonth('), 'missing storage.clearMonth call');
  assert(html.includes('confirm('), 'missing confirmation prompt');
}
console.log('PASS clear calendar UI elements and confirmation prompt present');

// 20. Clear Month wipes single month and preserves others with undo/redo
{
  const s = new StorageAdapter();
  s.state = D.createInitialAppState();
  s.state.activeCycleId = '2027-H1';
  s.state.cycles['2027-H1'].assignments = {
    '2027-01-15': 'polcha',
    '2027-02-14': 'kemerer',
    '2027-03-10': 'terek'
  };
  s.state.cycles['2027-FULL'].assignments = {
    '2027-01-15': 'polcha',
    '2027-02-14': 'kemerer',
    '2027-03-10': 'terek'
  };

  // Clear February (monthIdx 1)
  assert(s.clearMonth(2027, 1, '2027-H1'));
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-02-14'], undefined);
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-15'], 'polcha');
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-03-10'], 'terek');
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-02-14'], undefined);
  assert.strictEqual(s.state.cycles['2027-FULL'].assignments['2027-01-15'], 'polcha');

  // Undo restores February
  assert(s.undo());
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-02-14'], 'kemerer');

  // Redo wipes February again
  assert(s.redo());
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-02-14'], undefined);
}
console.log('PASS clear month engine and undo/redo');

// 21. New UI features: Show All, dropdown autofocus, holiday emoji removal, print header suppression
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // 1. Show All button
  assert(html.includes('>Show All</button>'), 'missing Show All month button');
  // 2. Dropdown focus
  assert(html.includes('select.focus()'), 'missing select.focus() in reassignment modal');
  // 3. Clear Calendar scope modal
  assert(html.includes('id="modal-clear-calendar"'), 'missing modal-clear-calendar');
  assert(html.includes('id="clear-scope-month"'), 'missing clear-scope-month radio');
  assert(html.includes('id="clear-scope-cycle"'), 'missing clear-scope-cycle radio');
  // 4. Holiday breakdown emoji removed
  assert(!html.includes('&#127881; Official Holidays Coverage Breakdown'), 'holiday emoji should be removed');
  assert(html.includes('Official Holidays Coverage Breakdown</h3>'), 'holiday header text preserved without emoji');
  // 5. Print header suppression
  assert(html.includes('@page {'), 'missing @page rule');
  assert(html.includes('margin: 0;'), 'missing print margin: 0 to suppress browser header/footer');
  assert(html.includes("document.title = '';"), 'missing title suppression during beforeprint');
}
console.log('PASS show-all, dropdown focus, scope modal, emoji removal, and print suppression present');

// 22. FULL year autogenerate preserves existing H1 and H2 assignments
{
  const cFull = cycles[2]; // FULL
  const cH1 = cycles[0]; // H1
  // Solve H1 first
  const rH1 = solveSchedule(cH1, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  // Lock H1 assignments into FULL
  const locked = { ...rH1.assignments };
  const rFull = solveSchedule(cFull, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, locked, []);
  // Every day in H1 must match rH1 exactly
  for (const [d, memberId] of Object.entries(rH1.assignments)) {
    assert.strictEqual(rFull.assignments[d], memberId, `H1 assignment on ${d} changed in FULL`);
  }
  // And H2 days must now be assigned
  assert.strictEqual(Object.keys(rFull.assignments).length, 365, 'Entire year must be assigned');
}
console.log('PASS FULL year preserves existing H1 assignments');

// 23. H2 autogenerate balances against H1 assignments across the boundary
{
  const cH1 = cycles[0]; // H1
  const cH2 = cycles[1]; // H2
  const rH1 = solveSchedule(cH1, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, []);
  
  // Find who worked the last weekend of H1 (June 25-27, 2027)
  const lastH1Worker = rH1.assignments['2027-06-26'];
  assert(lastH1Worker, 'Last weekend of H1 must be assigned');

  // Solve H2 with prior H1 context
  const rH2 = solveSchedule(cH2, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, [], {
    priorAssignments: rH1.assignments
  });

  // 1. Boundary check: Last H1 worker cannot work first weekend of H2 (July 2-4)
  assert.notStrictEqual(rH2.assignments['2027-07-03'], lastH1Worker, 'Last H1 worker cannot work first weekend of H2');

  // 2. Boundary rest: If last H1 worker is FT, cannot work Thursday July 1
  const mem = D.DEFAULT_2027_ROSTER.find(m => m.id === lastH1Worker);
  if (mem && mem.role === 'FT') {
    assert.notStrictEqual(rH2.assignments['2027-07-01'], lastH1Worker, 'FT last weekend worker cannot work July 1 (rest)');
  }

  // 3. FT Weekend counts across the whole year must be balanced
  const combined = { ...rH1.assignments, ...rH2.assignments };
  const allWeekends = identifyWeekends('2027-01-01', '2027-12-31', D.DEFAULT_2027_HOLIDAYS);
  const ftWkCounts = { polcha: 0, terek: 0, wolfe: 0 };
  allWeekends.forEach(w => {
    const wId = combined[w.saturday];
    if (ftWkCounts[wId] !== undefined) ftWkCounts[wId]++;
  });
  const spread = Math.max(...Object.values(ftWkCounts)) - Math.min(...Object.values(ftWkCounts));
  assert(spread <= 1, `Annual FT weekend spread must be <= 1, got ${spread} (${JSON.stringify(ftWkCounts)})`);
}
console.log('PASS H2 balances against H1 and respects boundary');

// 24. Manual assignment rule violation detection in UI script
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('checkManualAssignmentRuleViolations'), 'missing checkManualAssignmentRuleViolations');
  assert(html.includes('POST_WEEKEND_REST'), 'missing POST_WEEKEND_REST check in manual assignment');
  assert(html.includes('Post-Weekend Days Off:'), 'missing days off message in violation alert');
  assert(html.includes('Do you want to manually overwrite this rule'), 'missing overwrite confirmation prompt');
}
console.log('PASS manual assignment violation check and overwrite prompt present');

// 25. Rules README, User Guide, Menu Bar Single Line, and Refract Theme
{
  const rules = fs.readFileSync(new URL('../SCHEDULE_RULES.md', import.meta.url), 'utf8');
  assert(rules.includes('Mandatory Days Off (Thursday through Sunday)'), 'missing rest days in rules readme');
  assert(rules.includes('Quota per 6-Month Block'), 'missing alternate quota in rules readme');
  assert(rules.includes('Attached vs Standalone Holidays') || rules.includes('Attached vs. Standalone Holidays'), 'missing holiday rules');

  const guide = fs.readFileSync(new URL('../USER_GUIDE.md', import.meta.url), 'utf8');
  assert(guide.includes('What the Dots on the Calendar Mean'), 'missing dots section in guide');
  assert(guide.includes('Red Dot'), 'missing Red Dot in guide');
  assert(guide.includes('Amber Dot'), 'missing Amber Dot in guide');
  assert(guide.includes('Blue Dot'), 'missing Blue Dot in guide');

  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('id="btn-open-guide"'), 'missing btn-open-guide button');
  assert(html.includes('id="btn-open-rules"'), 'missing btn-open-rules button');
  assert(html.includes('id="modal-guide"'), 'missing modal-guide element');
  assert(html.includes('id="modal-rules"'), 'missing modal-rules element');
  assert(html.includes('theme: Refract'), 'missing Refract theme stamp');
  assert(html.includes('Funnel Display'), 'missing Funnel Display font');
  assert(html.includes('Funnel Sans'), 'missing Funnel Sans font');
  assert(html.includes('--color-paper'), 'missing Refract paper token');
  assert(html.includes('--color-ink'), 'missing Refract ink token');
}
console.log('PASS READMEs, how-to-use & rules buttons, single-line menu, and Refract theme verified');

// 26. Menu Bar Fit Without Scroll, Import/Export Far Right, Functional Guide, and Matrix Print Filter
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // 1. Menu Bar Order: Backup & Restore between Schedule Rules and Import; Export Excel on far right
  const guideIdx = html.indexOf('id="btn-open-guide"');
  const rulesIdx = html.indexOf('id="btn-open-rules"');
  const backupIdx = html.indexOf('id="btn-backup-export"');
  const restoreIdx = html.indexOf('id="btn-backup-restore"');
  const importIdx = html.indexOf('id="btn-open-import"');
  const exportIdx = html.indexOf('id="btn-export-excel"');

  assert(guideIdx !== -1 && rulesIdx !== -1 && backupIdx !== -1 && restoreIdx !== -1 && importIdx !== -1 && exportIdx !== -1, 'missing ribbon buttons');
  assert(guideIdx < rulesIdx, 'How to Use should precede Schedule Rules');
  assert(rulesIdx < backupIdx, 'Backup should be placed after Schedule Rules');
  assert(backupIdx < restoreIdx, 'Restore should be placed after Backup');
  assert(restoreIdx < importIdx, 'Import should be placed after Restore');
  assert(importIdx < exportIdx, 'Export Excel should be placed to the right of Import');

  // 2. Ribbon styling & gap
  assert(html.includes('.ribbon-actions .btn'), 'missing ribbon button styling');
  assert(html.includes('scrollbar-width: none'), 'ribbon scrollbar must be hidden');
  assert(html.includes('justify-content: space-between'), 'ribbon must maintain gap between breakdown tabs and roster actions');

  // 3. Matrix print filter
  assert(html.includes('.matrix-print-hide'), 'missing matrix-print-hide class');
  assert(html.includes('.matrix-print-hide {'), 'missing matrix-print-hide print rule');
  assert(html.includes('class="matrix-print-hide">Role</th>'), 'Role column header must have matrix-print-hide');
  assert(html.includes('class="matrix-print-hide">Attached Holiday</th>'), 'Attached Holiday column header must have matrix-print-hide');
  assert(html.includes('class="matrix-print-hide">Status</th>'), 'Status column header must have matrix-print-hide');

  // 4. Functional user guide
  const guide = fs.readFileSync(new URL('../USER_GUIDE.md', import.meta.url), 'utf8');
  assert(!guide.includes('Generating a Contract-Compliant Schedule'), 'guide should not contain removed header');
  assert(guide.includes('Verify Roster'), 'guide missing quick-start task workflow');
  assert(guide.includes('Multi-Period & Full-Year Scheduling'), 'guide missing multi-period scheduling workflow');
  assert(guide.includes('Manually Assigning or Adjusting Shifts'), 'guide missing manual assignment instructions');
  assert(guide.includes('Clearing Shifts (Current Month vs Entire Cycle)'), 'guide missing clear calendar instructions');
  assert(guide.includes('Printing and Exporting'), 'guide missing printing and exporting instructions');
}
console.log('PASS menu bar fit, import/export far right, functional guide, and matrix print filter verified');

// 27. Pinned Notes, Switch Suggestions, Roster Rank/First Name, and Matrix Print Date/Name Formats
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // Pinned button placement between How to Use and Schedule Rules
  const guideIdx = html.indexOf('id="btn-open-guide"');
  const pinnedIdx = html.indexOf('id="btn-open-pinned"');
  const rulesIdx = html.indexOf('id="btn-open-rules"');
  assert(guideIdx !== -1 && pinnedIdx !== -1 && rulesIdx !== -1, 'missing guide, pinned, or rules button');
  assert(guideIdx < pinnedIdx && pinnedIdx < rulesIdx, 'Pinned button must be positioned between How to Use and Schedule Rules');

  // Pinned Notes and Attention modals
  assert(html.includes('id="modal-pinned-notes"'), 'missing modal-pinned-notes');
  assert(html.includes('id="modal-schedule-attention"'), 'missing modal-schedule-attention');
  assert(html.includes('id="btn-clear-all-pinned"'), 'missing btn-clear-all-pinned');

  // Roster rank and first name inputs
  assert(html.includes('id="member-rank-input"'), 'missing member-rank-input in roster modal');
  assert(html.includes('id="member-firstname-input"'), 'missing member-firstname-input in roster modal');

  // Matrix print date and member name formats
  assert(html.includes('formatWeekendPrintDate'), 'missing formatWeekendPrintDate helper');
  assert(html.includes('getMemberPrintName'), 'missing getMemberPrintName helper');
  assert(html.includes('Trooper Sean POLCHA'), 'missing default full name formatting in domain roster');
  assert(html.includes('Trooper Ryan KEMERER'), 'missing default full name formatting in domain roster');

  // Rules text: 80 hours cap and Trooper recovery
  const rules = fs.readFileSync(new URL('../SCHEDULE_RULES.md', import.meta.url), 'utf8');
  assert(!rules.includes('87 hours'), 'rules should not contain 87 hours');
  assert(rules.includes('80 hours'), 'rules must specify 80 hours cap');
  assert(!rules.includes('high-tempo'), 'rules should not contain high-tempo');
  assert(rules.includes('To guarantee Trooper recovery following weekend duty'), 'rules must refer to Trooper recovery');
}
console.log('PASS pinned notes, switch suggestions, roster rank/first name, and matrix print date/name verified');

// 28. Standalone index.html syntax validity across all inline scripts
{
  const vm = await import('vm');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptCount = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptCount++;
    const code = match[1];
    // Will throw SyntaxError if any raw newline or malformed token exists
    new vm.Script(code);
  }
  assert(scriptCount >= 2, 'index.html must have inline scripts');
}
console.log('PASS index.html script tags syntax verified with vm.Script');

// 29. Proactive lookahead simulation switch suggestions & circular dependency prevention
{
  const cycle = { id: '2027-H1', year: 2027, blockType: 'H1', startDate: '2027-01-01', endDate: '2027-06-30' };
  const prefs = [
    { id: '1', memberId: 'terek', weekendFriday: '2027-01-01' },
    { id: '2', memberId: 'zeiders', weekendFriday: '2027-01-22' },
    { id: '3', memberId: 'kemerer', weekendFriday: '2027-01-29' },
    { id: '4', memberId: 'reed', weekendFriday: '2027-02-05' },
    { id: '5', memberId: 'chester', weekendFriday: '2027-02-26' },
    { id: '6', memberId: 'zeiders', weekendFriday: '2027-03-19' },
    { id: '7', memberId: 'chester', weekendFriday: '2027-04-02' },
    { id: '8', memberId: 'reed', weekendFriday: '2027-04-16' },
    { id: '9', memberId: 'chester', weekendFriday: '2027-05-07' }, // Covers Wolfe lookahead (May 7-9)
    { id: '10', memberId: 'zeiders', weekendFriday: '2027-05-14' },
    { id: '11', memberId: 'reed', weekendFriday: '2027-06-11' },
    { id: '12', memberId: 'terek', weekendFriday: '2027-06-18' }
  ];
  // Jun 25-27 needs an Alternate for Terek's leave, but all Alternates are at quota
  const res = solveSchedule(cycle, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, prefs);
  assert.strictEqual(res.scheduleNotices.length, 1, 'Should report 1 lookahead notice for Jun 25-27');
  const notice = res.scheduleNotices[0];
  assert(notice.includes('Best Recommendation (verified conflict-free):'), 'Must present simulation-verified Best Recommendation');
  assert(notice.includes('Protected Weekends (do NOT switch):'), 'Must present Protected Weekends section');
  assert(notice.includes("Trooper Matthew CHESTER requested May 7–9: protects schedule ahead of Trooper Jonathon WOLFE's leave"), 'Must protect May 7-9 from being switched');
  assert(notice.includes('Trooper Matthew CHESTER: could switch requested weekend Feb 26–28 or Apr 2–4 to Jun 25–27'), 'Must suggest clean donor weekends for Chester');

  // Verify applying the Best Recommendation produces a clean schedule
  const cleanPrefs = prefs.map(p => p.id === '5' ? { ...p, weekendFriday: '2027-06-25' } : p);
  const cleanRes = solveSchedule(cycle, D.DEFAULT_2027_ROSTER, D.DEFAULT_2027_BLACKOUTS, D.DEFAULT_2027_HOLIDAYS, {}, cleanPrefs);
  assert.strictEqual(cleanRes.scheduleNotices.length, 0, 'Clean switch must produce zero schedule notices');
  assert.strictEqual(cleanRes.preferenceWarnings.length, 0, 'Clean switch must produce zero preference warnings');
}
console.log('PASS lookahead simulation switch suggestions & circular dependency prevention verified');

// 30. Blackouts chronological order, Friday weekend fill prompt, and print suppression
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // Requirement 1: Chronological blackouts order
  assert(html.includes("list.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')"), 'cycleBlackouts must sort blackouts chronologically by startDate');
  const unsortedBlackouts = [
    { id: 'b3', startDate: '2027-05-10', endDate: '2027-05-14' },
    { id: 'b1', startDate: '2027-01-16', endDate: '2027-01-17' },
    { id: 'b2', startDate: '2027-03-01', endDate: '2027-03-05' }
  ];
  const sorted = unsortedBlackouts.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (a.endDate || '').localeCompare(b.endDate || ''));
  assert.strictEqual(sorted[0].id, 'b1', 'Earliest blackout must be first');
  assert.strictEqual(sorted[1].id, 'b2', 'Middle blackout must be second');
  assert.strictEqual(sorted[2].id, 'b3', 'Latest blackout must be third');

  // Requirement 2: Friday weekend fill prompt
  assert(html.includes("Would you like to fill the weekend with '${memDisplayName}'?"), 'Friday click must prompt to fill weekend with member name');
  assert(html.includes("const isFriday = d.getDay() === 5;"), 'Must detect Friday for weekend fill');
  assert(html.includes("const weekendDays = [selectedDateForReassign, sat, sun];"), 'Must identify weekend days for weekend fill');
  assert(html.includes("if (attachedMon) weekendDays.push(mon);"), 'Must include attached Monday when holiday is present');

  // Requirement 3: Print suppression of adjust instructions and staffed count
  assert(html.includes('.print-hide {\n        display: none !important;\n      }'), 'Print CSS must include .print-hide rule');
  assert(html.includes('<span class="print-hide">Click any date cell to manually adjust shift assignment.</span>'), 'Adjust shift instructions must be wrapped in print-hide');
  assert(html.includes('<div class="print-hide" style="font-size: 13px; color: var(--text-muted);">Staffed:'), 'Staffed count must be wrapped in print-hide');
}
console.log('PASS blackouts chronological order, Friday weekend fill prompt, and print suppression verified');

// 31. Alternate quota confirmation prior to manual assignment & automatic pinned note
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert(html.includes('function checkAndConfirmAltQuota('), 'Must include checkAndConfirmAltQuota function');
  assert(html.includes('Alternate Fire Marshal Quota Exceeded:'), 'Must include quota exceeded confirmation message');
  assert(html.includes('proposedWeekends.length > targetQuota && proposedWeekends.length > currentWeekends.length'), 'Must check if proposed weekends exceed roster quota');
  assert(html.includes("title: `Alternate Quota Exceeded: ${memDisplayName}`"), 'Must create pinned note with quota exceeded title');
  assert(html.includes("type: 'ALT_QUOTA_EXCEEDED'"), 'Must tag pinned note with ALT_QUOTA_EXCEEDED type');
  assert(html.includes('updatePinnedNotesButton();'), 'Must update pinned notes button when pin is added');
}
console.log('PASS alternate quota confirmation and automatic pinned note verified');





