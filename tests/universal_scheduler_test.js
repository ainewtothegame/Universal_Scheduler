import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

const xlsxSandbox = { window: {} };
xlsxSandbox.globalThis = xlsxSandbox;
xlsxSandbox.self = xlsxSandbox;
vm.runInNewContext(fs.readFileSync(new URL('../xlsx.full.min.js', import.meta.url), 'utf8'), xlsxSandbox);
const XLSX = xlsxSandbox.XLSX || xlsxSandbox.window.XLSX;

import {
  createUnitConfig,
  isMultiSlotConfig,
  getActiveSlotsForDate,
  getSlotMember,
  getRestBlockedDows,
  generateRulesSummaryHtml
} from '../src/unit_config.js';
import {
  createUniversalAppState,
  createInitialAppState,
  generateOfficialPSPHolidays,
  getMemberPrintName,
  formatDate,
  addDays
} from '../src/domain_data.js';
import { solveSchedule, identifyWeekends } from '../src/csp_solver.js';
import { evaluateScheduleConflicts, evaluateManualSlotAssignment } from '../src/conflict_engine.js';
import { StorageAdapter } from '../src/storage_adapter.js';
import { generateExcelWorkbook, parseSpreadsheet } from '../src/excel_engine.js';

// 1. Clean default Universal Scheduler startup (blank_psp, empty roster, PSP holidays, ranks)
{
  const state = createUniversalAppState('blank_psp', 2028);
  assert.strictEqual(state.version, 2);
  assert.strictEqual(state.roster.length, 0, 'New unit must start with empty roster');
  assert.strictEqual(state.blackouts.length, 0, 'New unit must start with empty blackouts');
  assert.strictEqual(state.holidays.length, 13, 'Should generate all 13 official PSP holidays');
  assert.strictEqual(state.unitConfig.presetId, 'blank_psp');

  assert.strictEqual(getMemberPrintName({ rank: 'Corporal', firstName: 'Jane', name: 'DOE' }), 'Corporal Jane DOE');
  assert.strictEqual(getMemberPrintName({ rank: 'Sergeant', firstName: 'John', name: 'SMITH' }), 'Sergeant John SMITH');
}
console.log('PASS clean universal startup & PSP ranks');

// 2. Fire Marshal preset parity when passed explicitly via unitConfig
{
  const fmState = createInitialAppState();
  const cycle = fmState.cycles['2027-H1'];
  const res = solveSchedule(cycle, fmState.roster, fmState.blackouts, fmState.holidays, {}, [], {
    unitConfig: fmState.unitConfig
  });
  const conflicts = evaluateScheduleConflicts(cycle, fmState.roster, fmState.blackouts, fmState.holidays, res.assignments, fmState.unitConfig);
  const errors = Object.values(conflicts).flat().filter(c => c.type === 'ERROR');
  assert.strictEqual(errors.length, 0, 'Fire Marshal preset must have 0 errors');
  assert.strictEqual(Object.keys(res.assignments).length, 181, 'H1 must staff all 181 days');
}
console.log('PASS Fire Marshal preset parity via unitConfig');

// 3. AM / PM Split On-Call scheduling & same-day conflict prevention
{
  const cfg = createUnitConfig('am_pm_split');
  assert.strictEqual(isMultiSlotConfig(cfg), true);

  // Weekday (non-holiday) only has PM slot; weekend & holiday have AM + PM
  const monSlots = getActiveSlotsForDate('2027-01-04', cfg, []);
  assert.deepStrictEqual(monSlots.map(s => s.id), ['pm']);
  const satSlots = getActiveSlotsForDate('2027-01-09', cfg, []);
  assert.deepStrictEqual(satSlots.map(s => s.id), ['am', 'pm']);
  const holSlots = getActiveSlotsForDate('2027-01-18', cfg, [{ date: '2027-01-18', name: 'MLK Day', type: 'attached_mon' }]);
  assert.deepStrictEqual(holSlots.map(s => s.id), ['am', 'pm']);

  const roster = [
    { id: 'm1', rank: 'Trooper', firstName: 'A', name: 'ALPHA', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#111' },
    { id: 'm2', rank: 'Corporal', firstName: 'B', name: 'BRAVO', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#222' },
    { id: 'm3', rank: 'Sergeant', firstName: 'C', name: 'CHARLIE', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#333' },
    { id: 'm4', rank: 'Trooper', firstName: 'D', name: 'DELTA', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#444' }
  ];
  const cycle = { id: '2027-Q1', year: 2027, blockType: 'CUSTOM', startDate: '2027-01-01', endDate: '2027-01-31' };
  const holidays = generateOfficialPSPHolidays(2027);
  const res = solveSchedule(cycle, roster, [], holidays, {}, [], { unitConfig: cfg });

  // Verify every active slot on every day is filled and no same-day AM+PM double-booking
  for (let d = 1; d <= 31; d++) {
    const ds = `2027-01-${String(d).padStart(2, '0')}`;
    const active = getActiveSlotsForDate(ds, cfg, holidays);
    const workers = active.map(s => getSlotMember(res.assignments, ds, s.id, cfg));
    assert(workers.every(Boolean), `All active slots on ${ds} must be staffed`);
    if (workers.length === 2) {
      assert.notStrictEqual(workers[0], workers[1], `Same member cannot work both AM & PM on ${ds}`);
    }
  }

  // Verify conflict engine catches manual same-day AM/PM assignment
  const manualViols = evaluateManualSlotAssignment('2027-01-09', 'am', getSlotMember(res.assignments, '2027-01-09', 'pm', cfg), { ...cycle, assignments: res.assignments }, roster, [], holidays, cfg);
  assert(manualViols.some(v => v.type === 'AM_PM_SAME_DAY'), 'Conflict engine must flag AM_PM_SAME_DAY');
}
console.log('PASS AM/PM split scheduling & conflict detection');

// 4. PSP 80-hour rest patterns (mon_tue_off, tue_wed_off, wed_wed_thu_sun) & 80-hr biweekly pay period check
{
  const roster = [
    { id: 't1', name: 'ONE', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#111' },
    { id: 't2', name: 'TWO', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#222' },
    { id: 't3', name: 'THREE', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#333' },
    { id: 't4', name: 'FOUR', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#444' }
  ];
  const cycle = { id: '2027-JAN', year: 2027, blockType: 'CUSTOM', startDate: '2027-01-01', endDate: '2027-01-31' };

  for (const [patternId, expectedBlocked] of [
    ['mon_tue_off', [1, 2]],
    ['tue_wed_off', [2, 3]],
    ['wed_wed_thu_sun', [4]]
  ]) {
    const cfg = createUnitConfig('blank_psp', {
      rules: { blockPattern: 'fri_sun', restPattern: patternId, minWeekendGap: 1, enforce80HourCap: true, payPeriodAnchorMonday: '2027-01-04' }
    });
    assert.deepStrictEqual(getRestBlockedDows(cfg).midweekBlocked, expectedBlocked);
    const res = solveSchedule(cycle, roster, [], [], {}, [], { unitConfig: cfg });
    const conflicts = evaluateScheduleConflicts(cycle, roster, [], [], res.assignments, cfg);
    const restErrors = Object.values(conflicts).flat().filter(c => c.code === 'REST_VIOLATION');
    assert.strictEqual(restErrors.length, 0, `Rest pattern ${patternId} must produce 0 REST_VIOLATION`);

    // Verify conflict engine detects violation if weekend worker is forced onto blocked day
    const wknds = identifyWeekends(cycle.startDate, cycle.endDate, []);
    const wkWorker = res.assignments[wknds[0].saturday];
    const blockedDow = expectedBlocked[0];
    const offset = (blockedDow - 5 + 7) % 7;
    const badDate = formatDate(addDays(wknds[0].friday, offset));
    const viols = evaluateManualSlotAssignment(badDate, 'primary', wkWorker, { ...cycle, assignments: res.assignments }, roster, [], [], cfg);
    assert(viols.some(v => v.type === 'REST_VIOLATION'), `Manual assignment on ${badDate} for ${patternId} must flag REST_VIOLATION`);
  }

  // 80-hour biweekly check: 2 weekends in the same 14-day pay period
  const cfg80 = createUnitConfig('blank_psp', {
    rules: { blockPattern: 'fri_sun', restPattern: 'none', minWeekendGap: 0, enforce80HourCap: true, payPeriodAnchorMonday: '2027-01-04' }
  });
  const badAssign = {
    '2027-01-08': 't1', '2027-01-09': 't1', '2027-01-10': 't1',
    '2027-01-15': 't1', '2027-01-16': 't1', '2027-01-17': 't1'
  };
  const c80 = evaluateScheduleConflicts(cycle, roster, [], [], badAssign, cfg80);
  assert(Object.values(c80).flat().some(c => c.code === 'PAY_PERIOD_80HR_RISK'), 'Must flag PAY_PERIOD_80HR_RISK when working 2 weekends in one 14-day pay period');
}
console.log('PASS PSP 80-hour rest patterns & biweekly pay period checks');

// 5. 7-Day Full-Week rotation & Daily Independent mode
{
  const roster = [
    { id: 'u1', name: 'ALPHA', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#111' },
    { id: 'u2', name: 'BRAVO', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#222' },
    { id: 'u3', name: 'CHARLIE', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#333' }
  ];
  const cycle = { id: '2027-JAN', year: 2027, blockType: 'CUSTOM', startDate: '2027-01-04', endDate: '2027-01-24' };

  const weeklyCfg = createUnitConfig('weekly_rotation');
  const wkRes = solveSchedule(cycle, roster, [], [], {}, [], { unitConfig: weeklyCfg });
  // Week 1 (Jan 4..10) should all have same worker
  const w1Worker = wkRes.assignments['2027-01-04'];
  assert(w1Worker);
  for (let d = 4; d <= 10; d++) {
    assert.strictEqual(wkRes.assignments[`2027-01-${String(d).padStart(2, '0')}`], w1Worker);
  }

  const dailyCfg = createUnitConfig('blank_psp', {
    rules: { blockPattern: 'daily_independent', restPattern: 'none', minWeekendGap: 0 }
  });
  const dayRes = solveSchedule(cycle, roster, [], [], {}, [], { unitConfig: dailyCfg });
  assert.strictEqual(Object.keys(dayRes.assignments).length, 21, 'Daily independent mode must staff all 21 days');
}
console.log('PASS 7-day full-week & daily independent modes');

// 6. Storage v1->v2 migration, Full Backup, Config Template export/import, and AM/PM Undo/Redo
{
  const store = {};
  globalThis.window = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  const s = new StorageAdapter();
  assert.strictEqual(s.state.version, 2);
  assert.strictEqual(s.state.roster.length, 0);

  // Legacy v1 backup migration
  const legacyV1 = {
    version: 1,
    roster: [{ id: 'polcha', name: 'POLCHA', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#1e3a8a' }],
    blackouts: [],
    preferredWeekends: [],
    holidays: [],
    cycles: {
      '2027-H1': { id: '2027-H1', year: 2027, blockType: 'H1', startDate: '2027-01-01', endDate: '2027-06-30', assignments: { '2027-01-01': 'polcha' }, manualOverrides: {} }
    },
    activeCycleId: '2027-H1'
  };
  assert.strictEqual(s.importBackupJSON(JSON.stringify(legacyV1)), true);
  assert.strictEqual(s.state.version, 2);
  assert.strictEqual(s.state.unitConfig.presetId, 'fire_marshal');
  assert.strictEqual(s.state.cycles['2027-H1'].assignments['2027-01-01'], 'polcha');

  // Config template export/import without wiping roster
  s.state.unitConfig = createUnitConfig('am_pm_split', { unitName: 'Special Ops Unit' });
  const tplJson = s.exportConfigTemplateJSON();
  const s2 = new StorageAdapter();
  s2.state.roster = [{ id: 'x1', name: 'TESTER', role: 'FT', activeStart: '2027-01-01', color: '#000' }];
  assert.strictEqual(s2.importConfigTemplateJSON(tplJson), true);
  assert.strictEqual(s2.state.unitConfig.unitName, 'Special Ops Unit');
  assert.strictEqual(isMultiSlotConfig(s2.state.unitConfig), true);
  assert.strictEqual(s2.state.roster.length, 1, 'Config template import must preserve existing roster');

  // Deep-cloned undo/redo in AM/PM mode
  s2.state.cycles['2027-H1'].assignments['2027-01-09'] = { am: 'x1', pm: 'x2' };
  s2.pushUndo('2027-H1');
  s2.state.cycles['2027-H1'].assignments['2027-01-09'].am = 'x3';
  assert.strictEqual(s2.undo(), true);
  assert.strictEqual(s2.state.cycles['2027-H1'].assignments['2027-01-09'].am, 'x1', 'Undo must restore nested AM/PM slot');
  assert.strictEqual(s2.redo(), true);
  assert.strictEqual(s2.state.cycles['2027-H1'].assignments['2027-01-09'].am, 'x3', 'Redo must restore nested AM/PM slot');

  delete globalThis.window;
}
console.log('PASS v1->v2 migration, config templates & AM/PM undo/redo');

// 7. Excel export & parse for AM/PM multi-slot grids + live Rules Summary HTML
{
  const cfg = createUnitConfig('am_pm_split', { unitName: 'Troop H Aviation' });
  const roster = [
    { id: 'a1', name: 'ALPHA', role: 'FT', color: '#111' },
    { id: 'a2', name: 'BRAVO', role: 'FT', color: '#222' }
  ];
  const cycle = { id: '2027-H1', year: 2027, blockType: 'H1', startDate: '2027-01-01', endDate: '2027-01-31' };
  const assignments = {
    '2027-01-09': { am: 'a1', pm: 'a2' }
  };
  const wb = generateExcelWorkbook(XLSX, cycle, roster, assignments, cfg);
  const parsed = parseSpreadsheet(XLSX, XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }), false);
  assert(parsed.rawNames.includes('ALPHA') && parsed.rawNames.includes('BRAVO'), 'Excel export/import must preserve AM & PM names');

  const summaryHtml = generateRulesSummaryHtml(cfg, generateOfficialPSPHolidays(2027));
  assert(summaryHtml.includes('Troop H Aviation') && summaryHtml.includes('AM On-Call') && summaryHtml.includes('PM On-Call'));
}
console.log('PASS AM/PM Excel export/import & live rules summary HTML');

// 8. Post-weekend rest & consecutive weekend warnings on ALL of Thu, Fri, Sat, Sun
{
  const cfg = createUnitConfig('blank_psp', {
    rules: {
      blockPattern: 'fri_sun',
      restPattern: 'custom',
      customRestDows: [3, 4, 5, 6, 0], // Wed-Sun off after worked weekend
      minWeekendGap: 1
    }
  });
  const roster = [
    { id: 't1', name: 'ALPHA', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#111' },
    { id: 't2', name: 'BRAVO', role: 'FT', activeStart: '2027-01-01', activeEnd: null, color: '#222' }
  ];
  const cycle = {
    id: '2027-JAN',
    year: 2027,
    blockType: 'CUSTOM',
    startDate: '2027-01-01',
    endDate: '2027-01-31',
    assignments: {
      '2027-01-08': 't1', '2027-01-09': 't1', '2027-01-10': 't1' // Worked Jan 8-10 weekend
    }
  };
  // Attempting to schedule t1 on Thu Jan 14, Fri Jan 15, Sat Jan 16, or Sun Jan 17 MUST warn!
  for (const dStr of ['2027-01-14', '2027-01-15', '2027-01-16', '2027-01-17']) {
    const viols = evaluateManualSlotAssignment(dStr, 'primary', 't1', cycle, roster, [], [], cfg);
    assert(
      viols.some(v => v.type === 'REST_VIOLATION' || v.type === 'CONSECUTIVE_WEEKEND'),
      `Manual assignment on ${dStr} after worked weekend must trigger a warning`
    );
  }
}
console.log('PASS post-weekend & consecutive weekend warnings on Thu/Fri/Sat/Sun');

// 9. Per-member weekend cadence (Every 3rd weekend -> minWeekendGap: 2) & Assigned/Preferred Weekday
{
  const cfg = createUnitConfig('blank_psp', {
    rules: {
      blockPattern: 'fri_sun',
      restPattern: 'none',
      weekdayMode: 'dynamic_equity',
      minWeekendGap: 1
    }
  });
  const roster = [
    { id: 'm1', name: 'ALPHA', role: 'FT', baselineWeekday: 1, preferredWeekday: 1, minWeekendGap: 2, activeStart: '2027-01-01', color: '#111' },
    { id: 'm2', name: 'BRAVO', role: 'FT', baselineWeekday: 2, preferredWeekday: 2, activeStart: '2027-01-01', color: '#222' },
    { id: 'm3', name: 'CHARLIE', role: 'FT', baselineWeekday: 3, preferredWeekday: 3, activeStart: '2027-01-01', color: '#333' },
    { id: 'm4', name: 'DELTA', role: 'FT', baselineWeekday: 4, preferredWeekday: 4, activeStart: '2027-01-01', color: '#444' }
  ];
  const cycle = { id: '2027-Q1', year: 2027, blockType: 'CUSTOM', startDate: '2027-01-01', endDate: '2027-02-28' };
  const res = solveSchedule(cycle, roster, [], [], {}, [], { unitConfig: cfg });
  const wknds = identifyWeekends(cycle.startDate, cycle.endDate, []);
  const m1Weekends = wknds.filter(w => res.assignments[w.saturday] === 'm1').map(w => w.index);
  for (let i = 1; i < m1Weekends.length; i++) {
    assert(m1Weekends[i] - m1Weekends[i - 1] >= 3, 'm1 (every 3rd weekend) must have at least 2 weekends off between shifts');
  }
  // Verify weekday preference is honored when fair
  assert.strictEqual(res.assignments['2027-01-04'], 'm1', 'Monday should prefer m1');
  assert.strictEqual(res.assignments['2027-01-05'], 'm2', 'Tuesday should prefer m2');
}
console.log('PASS per-member weekend cadence & assigned/preferred weekday');

// 10. Built index.html Universal Scheduler UX & bugfix hooks
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('id="btn-export-config-template"'), 'index.html must include config template export');
  assert(html.includes('id="setup-slot-mode-ampm"'), 'index.html must include AM/PM slot toggle');
  assert(html.includes('id="psp-ranks-list"'), 'index.html must include PSP ranks datalist');
  assert(html.includes('id="post-weekend-rest-strip"'), 'index.html must include clickable post-weekend rest strip');
  assert(html.includes('id="regular-workweek-strip"'), 'index.html must include clickable regular workweek strip');
  assert(html.includes('id="member-weekend-cadence-input"'), 'index.html must include per-member weekend cadence selector');
  assert(!html.includes('id="member-prefday-input"'), 'index.html must not have duplicate weekday preference dropdown');
  assert(!html.includes('value="fire_marshal_phased_2027"'), 'index.html weekday dropdown must not show Fire Marshal 2027 phased option');
  assert(html.includes('class="help-tip"'), 'index.html must include hover tooltips');
  assert(html.includes('blackoutEndDateTouched'), 'index.html must auto-jump blackout end date to start date');
}
console.log('PASS index.html Universal Scheduler UX & bugfix hooks verified');
