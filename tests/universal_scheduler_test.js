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
  // Verify weekday preference is honored when member is not already ahead on total shifts
  assert.strictEqual(res.assignments['2027-01-12'], 'm4', 'm4 (tied on weekend load) should be preferred on non-post-weekend weekday when no one has lower load');
  const m2WorkedJan8 = res.assignments['2027-01-09'] === 'm2';
  if (m2WorkedJan8) {
    assert.notStrictEqual(res.assignments['2027-01-12'], 'm2', 'm2 must avoid Tuesday Jan 12 right after working Jan 8-10 weekend');
  }
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
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert(pkg.version, 'package.json must define version');
  assert(html.includes('id="app-version-badge"') && html.includes(`v${pkg.version}`), 'index.html must display app version badge matching package.json');
  assert(!html.includes('btn-load-fm-sample'), 'index.html must not include Load Fire Marshal Sample Roster button');
  const versionedHtmlPath = new URL(`../On Call Schedule v${pkg.version}.html`, import.meta.url);
  assert(fs.existsSync(versionedHtmlPath), `On Call Schedule v${pkg.version}.html must exist`);
  assert.strictEqual(fs.readFileSync(versionedHtmlPath, 'utf8'), html, 'Versioned HTML and index.html must match');
}
console.log('PASS index.html & On Call Schedule versioned HTML verified');

// 11. User-reported 5-FT + 1-ALT JSON scenario (equity, cadence, ALT spacing, Mon/Tue rest, no bogus lookahead, clean rules summary)
{
  const cfg = createUnitConfig('fire_marshal', {
    weekStartDay: 0,
    rules: {
      regularWorkDays: [1, 2, 3, 4, 5],
      blockPattern: 'custom_block',
      customBlockDows: [5, 6, 0],
      restPattern: 'custom',
      customRestDows: [3, 4, 5, 6, 0],
      weekdayMode: 'custom_hybrid',
      minWeekendGap: 1,
      enforce80HourCap: true,
      payPeriodAnchorMonday: '2027-01-04',
      preWeekendShaping: true,
      proactiveAltLookahead: true,
      lookaheadLeaveThreshold: 3,
      allowSamePersonAmPm: false
    }
  });
  const roster = [
    { id: 'name_3285', rank: 'Trooper', firstName: 'one', name: 'ONE', role: 'FT', baselineWeekday: 3, preferredWeekday: 3, activeStart: '2027-01-01', activeEnd: null, color: '#1e3a8a', minWeekendGap: null },
    { id: 'name_4466', rank: 'Trooper', firstName: 'two', name: 'TWO', role: 'FT', baselineWeekday: null, preferredWeekday: null, activeStart: '2027-01-01', activeEnd: null, color: '#1e8a78', weekendCadence: 2, minWeekendGap: 1 },
    { id: 'name_7402', rank: 'Trooper', firstName: 'Three', name: 'THREE', role: 'FT', baselineWeekday: null, preferredWeekday: null, activeStart: '2027-01-01', activeEnd: null, color: '#08f70c' },
    { id: 'name_1839', rank: 'Trooper', firstName: 'Four', name: 'FOUR', role: 'FT', baselineWeekday: null, preferredWeekday: null, activeStart: '2027-01-01', activeEnd: null, color: '#f8f11b' },
    { id: 'five_3414', rank: 'Trooper', firstName: 'Five', name: 'FIVE', role: 'FT', baselineWeekday: null, preferredWeekday: null, activeStart: '2027-01-01', activeEnd: null, color: '#f8311b' },
    { id: 'six_8261', rank: 'Trooper', firstName: 'alt', name: 'SIX', role: 'ALT', baselineWeekday: null, preferredWeekday: null, weekendsPerSixMonths: 3, activeStart: '2027-01-01', activeEnd: null, color: '#e760f0' }
  ];
  const blackouts = [
    { id: 'b1', memberId: 'name_3285', startDate: '2027-01-09', endDate: '2027-01-17', year: 2027 },
    { id: 'b2', memberId: 'name_1839', startDate: '2027-01-26', endDate: '2027-01-31', year: 2027 },
    { id: 'b3', memberId: 'name_4466', startDate: '2027-01-08', endDate: '2027-01-10', year: 2027 },
    { id: 'b4', memberId: 'five_3414', startDate: '2027-02-06', endDate: '2027-02-13', year: 2027 },
    { id: 'b5', memberId: 'name_3285', startDate: '2027-02-15', endDate: '2027-02-20', year: 2027 }
  ];
  const holidays = generateOfficialPSPHolidays(2027);
  const h1 = { id: '2027-H1', year: 2027, blockType: 'H1', startDate: '2027-01-01', endDate: '2027-06-30' };
  const res = solveSchedule(h1, roster, blackouts, holidays, {}, [], { unitConfig: cfg });

  // Problem #3: No bogus Feb 12-14 lookahead notice with 5 FTs
  assert.strictEqual(res.scheduleNotices.length, 0, '5-FT unit must not emit bogus lookahead shortage notice');

  // Problem #1 + Total Shift Balance: All 4 non-cadence FTs finish within <= 3 total shifts and TWO (cadence=2) is not overloaded with weekdays
  const totCounts = {};
  roster.filter(m => m.role === 'FT').forEach(m => { totCounts[m.id] = 0; });
  for (const mId of Object.values(res.assignments)) {
    if (totCounts[mId] !== undefined) totCounts[mId]++;
  }
  const stdVals = ['name_3285', 'name_7402', 'name_1839', 'five_3414'].map(id => totCounts[id]);
  assert(Math.max(...stdVals) - Math.min(...stdVals) <= 3, `Total shift spread across standard FTs must be <= 3 (got ${JSON.stringify(totCounts)})`);
  assert(totCounts['name_4466'] <= 40, `TWO (cadence=2) in H1 must not be overloaded with weekdays (got ${totCounts['name_4466']})`);

  // Problem #2: TWO (weekendCadence: 2) works every-other-weekend target cadence (>= 10 weekends in H1)
  const wknds = identifyWeekends(h1.startDate, h1.endDate, holidays);
  const twoWeekends = wknds.filter(w => res.assignments[w.saturday] === 'name_4466').map(w => w.index);
  assert(twoWeekends.length >= 10, `TWO with every-other-weekend cadence should work >= 10 weekends in H1 (got ${twoWeekends.length})`);
  for (let i = 1; i < twoWeekends.length; i++) {
    assert(twoWeekends[i] - twoWeekends[i - 1] >= 2, 'TWO must never work back-to-back weekends');
  }

  // Problem #4: SIX (ALT) works 3 weekends in H1 spaced well apart (gap >= 4 weekends)
  const sixWeekends = wknds.filter(w => res.assignments[w.saturday] === 'six_8261').map(w => w.index);
  assert.strictEqual(sixWeekends.length, 3, 'SIX must work 3 weekends in H1');
  for (let i = 1; i < sixWeekends.length; i++) {
    assert(sixWeekends[i] - sixWeekends[i - 1] >= 4, `SIX ALT weekends must be spaced across H1, not every other weekend (indices: ${sixWeekends.join(',')})`);
  }

  // Problem #5: Zero Fri-Tue stretches (weekend worker never works following Tue in H1 when other FTs exist)
  wknds.forEach(w => {
    const wkWorker = res.assignments[w.saturday];
    const tueStr = formatDate(addDays(w.friday, 4));
    if (tueStr <= h1.endDate) {
      assert.notStrictEqual(res.assignments[tueStr], wkWorker, `Weekend worker ${wkWorker} on ${w.friday} must not work following Tuesday ${tueStr}`);
    }
  });

  // Problem #7: Single-shift Active Rules Summary must NOT list 17:00 or 08:00
  const sumHtml = generateRulesSummaryHtml(cfg, holidays);
  assert(!sumHtml.includes('17:00') && !sumHtml.includes('08:00'), 'Single On-Call Active Rules Summary must not list unused 17:00/08:00 times');
}
console.log('PASS user-reported 5-FT + 1-ALT JSON scenario verified');

// 8. v1.3.0 Regression Suite: Total Shift Equity, Consecutive Weekdays, Configurable Modes & Conflict Rules
{
  const holidays = generateOfficialPSPHolidays(2027);
  const fullCycle = { id: '2027-FULL', year: 2027, blockType: 'FULL', startDate: '2027-01-01', endDate: '2027-12-31' };
  const h1Cycle = { id: '2027-H1', year: 2027, blockType: 'H1', startDate: '2027-01-01', endDate: '2027-06-30' };
  const h2Cycle = { id: '2027-H2', year: 2027, blockType: 'H2', startDate: '2027-07-01', endDate: '2027-12-31' };

  const countMemberTotals = (assignments, roster) => {
    const totals = {};
    roster.forEach(m => { totals[m.id] = 0; });
    Object.values(assignments).forEach(v => {
      if (typeof v === 'string' && totals[v] !== undefined) totals[v]++;
      else if (v && typeof v === 'object') {
        Object.values(v).forEach(id => { if (id && totals[id] !== undefined) totals[id]++; });
      }
    });
    return totals;
  };
  const ftSpread = (totals, roster) => {
    const vals = roster.filter(m => m.role === 'FT').map(m => totals[m.id]);
    return Math.max(...vals) - Math.min(...vals);
  };
  const flatConflicts = (cycle, roster, blackouts, assignments, cfg) => {
    const cMap = evaluateScheduleConflicts(cycle, roster, blackouts, holidays, assignments, cfg);
    return Object.entries(cMap).flatMap(([d, arr]) => arr.map(c => ({ d, ...c })));
  };

  const roster5 = [
    { id: 'm1', name: 'ONE', role: 'FT', activeStart: '2027-01-01', activeEnd: null, baselineWeekday: 3, preferredWeekday: 3 },
    { id: 'm2', name: 'TWO', role: 'FT', activeStart: '2027-01-01', activeEnd: null },
    { id: 'm3', name: 'THREE', role: 'FT', activeStart: '2027-01-01', activeEnd: null },
    { id: 'm4', name: 'FOUR', role: 'FT', activeStart: '2027-01-01', activeEnd: null },
    { id: 'm5', name: 'FIVE', role: 'FT', activeStart: '2027-01-01', activeEnd: null },
    { id: 'a1', name: 'ALT1', role: 'ALT', activeStart: '2027-01-01', activeEnd: null, weekendsPerSixMonths: 3 }
  ];

  // 8a. Standard 5FT+1ALT custom_hybrid (ONE=Wed)
  {
    const cfg = createUnitConfig('blank_psp', {
      rules: { weekdayMode: 'custom_hybrid', restPattern: 'custom', customRestDows: [3, 4, 5, 6, 0], preWeekendShaping: true, proactiveAltLookahead: true }
    });
    const res = solveSchedule(fullCycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const totals = countMemberTotals(res.assignments, roster5);
    assert(ftSpread(totals, roster5) <= 3, `8a FT spread must be <= 3 (got ${ftSpread(totals, roster5)}: ${JSON.stringify(totals)})`);

    // Zero consecutive weekdays (Tue+Wed or Wed+Thu)
    const dates = Object.keys(res.assignments).sort();
    for (let i = 1; i < dates.length; i++) {
      const prev = dates[i - 1], curr = dates[i];
      const dow = new Date(curr + 'T00:00:00').getDay();
      if (dow >= 2 && dow <= 4 && formatDate(addDays(prev, 1)) === curr) {
        assert.notStrictEqual(res.assignments[prev], res.assignments[curr], `8a consecutive weekday ${prev} & ${curr} assigned to ${res.assignments[curr]}`);
      }
    }

    const conf = flatConflicts(fullCycle, roster5, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, '8a zero ERROR conflicts');
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, '8a zero WARNING conflicts');
    assert(conf.filter(c => c.code === 'MULTI_SHIFT_FT').length <= 4, `8a MULTI_SHIFT_FT must be <= 4 (got ${conf.filter(c => c.code === 'MULTI_SHIFT_FT').length})`);
  }

  // 8b. 5FT+1ALT with TWO cadence=2 + manual override resume + H1->H2 continuity
  {
    const cfg = createUnitConfig('blank_psp', {
      rules: { weekdayMode: 'custom_hybrid', restPattern: 'custom', customRestDows: [3, 4, 5, 6, 0], preWeekendShaping: true, proactiveAltLookahead: true }
    });
    const rosterCad = roster5.map(m => m.id === 'm2' ? { ...m, weekendCadence: 2, minWeekendGap: 1 } : m);
    const res = solveSchedule(fullCycle, rosterCad, [], holidays, {}, [], { unitConfig: cfg });
    const totals = countMemberTotals(res.assignments, rosterCad);
    const stdSpread = ftSpread(totals, rosterCad.filter(m => m.id !== 'm2'));
    assert(stdSpread <= 3, `8b standard FT spread with TWO cadence=2 must be <= 3 (got ${stdSpread}: ${JSON.stringify(totals)})`);
    assert(totals.m2 <= 76, `8b TWO (cadence=2) must not be overloaded with weekdays (got ${totals.m2})`);
    const conf = flatConflicts(fullCycle, rosterCad, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, '8b zero ERROR conflicts');
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, '8b zero WARNING conflicts');
    const twoMulti = conf.filter(c => c.code === 'MULTI_SHIFT_FT' && c.message.includes('TWO'));
    assert.strictEqual(twoMulti.length, 0, `8b TWO should have 0 double-weekday weeks (got ${twoMulti.length})`);

    // Manual override on w6 (2027-02-12..14) = THREE, blanking Feb 15..Dec 31 -> TWO picks right back up
    const wknds = identifyWeekends(fullCycle.startDate, fullCycle.endDate, holidays);
    const manualOverrides = {};
    [0, 2, 4].forEach(idx => {
      const w = wknds[idx];
      manualOverrides[w.friday] = 'm2'; manualOverrides[w.saturday] = 'm2'; manualOverrides[w.sunday] = 'm2';
    });
    const w6 = wknds[6]; // 2027-02-12..14
    manualOverrides[w6.friday] = 'm3'; manualOverrides[w6.saturday] = 'm3'; manualOverrides[w6.sunday] = 'm3';
    const resResume = solveSchedule(fullCycle, rosterCad, [], holidays, manualOverrides, [], { unitConfig: cfg });
    assert.strictEqual(resResume.assignments[w6.saturday], 'm3', '8b manual override THREE on w6 preserved');
    assert.strictEqual(resResume.assignments[wknds[7].saturday], 'm2', '8b TWO resumes immediately on w7');
    assert.strictEqual(resResume.assignments[wknds[9].saturday], 'm2', '8b TWO continues on w9');
    const confResume = flatConflicts(fullCycle, rosterCad, [], resResume.assignments, cfg);
    assert.strictEqual(confResume.filter(c => c.code === 'CONSECUTIVE_WEEKEND').length, 0, '8b resume has zero consecutive weekends');

    // H1 -> H2 cross-cycle continuity
    const rH1 = solveSchedule(h1Cycle, rosterCad, [], holidays, {}, [], { unitConfig: cfg });
    const rH2 = solveSchedule(h2Cycle, rosterCad, [], holidays, {}, [], { unitConfig: cfg, priorAssignments: rH1.assignments });
    const combined = { ...rH1.assignments, ...rH2.assignments };
    const combTotals = countMemberTotals(combined, rosterCad);
    const combStdSpread = ftSpread(combTotals, rosterCad.filter(m => m.id !== 'm2'));
    assert(combStdSpread <= 4, `8b H1+H2 combined standard FT spread must be <= 4 (got ${combStdSpread}: ${JSON.stringify(combTotals)})`);
    assert(combTotals.m2 <= 76, `8b H1+H2 combined TWO must not be overloaded with weekdays (got ${combTotals.m2})`);
    const confComb = flatConflicts(fullCycle, rosterCad, [], combined, cfg);
    assert.strictEqual(confComb.filter(c => c.type === 'ERROR' || c.type === 'WARNING').length, 0, '8b H1+H2 combined zero errors/warnings');
  }

  // 8c. 3FT + 0ALT fri_sun with mon_tue_off + attached Monday holidays
  {
    const cfg = createUnitConfig('blank_psp', { rules: { restPattern: 'mon_tue_off' } });
    const res = solveSchedule(fullCycle, roster5.slice(0, 3), [], holidays, {}, [], { unitConfig: cfg });
    const conf = flatConflicts(fullCycle, roster5.slice(0, 3), [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, `8c 3FT+0ALT must have 0 ERRORs (got ${JSON.stringify(conf.filter(c => c.type === 'ERROR'))})`);
  }

  // 8d. AM/PM Split (am_pm_split preset, 5FT + 1ALT)
  {
    const cfg = createUnitConfig('am_pm_split');
    const res = solveSchedule(fullCycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const conf = flatConflicts(fullCycle, roster5, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, `8d AM/PM zero ERRORs (got ${JSON.stringify(conf.filter(c => c.type === 'ERROR').slice(0, 3))})`);
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, `8d AM/PM zero WARNINGs (got ${JSON.stringify(conf.filter(c => c.type === 'WARNING').slice(0, 3))})`);

    // With TWO cadence=2 in AM/PM mode
    const rosterCad = roster5.map(m => m.id === 'm2' ? { ...m, weekendCadence: 2, minWeekendGap: 1 } : m);
    const resCad = solveSchedule(fullCycle, rosterCad, [], holidays, {}, [], { unitConfig: cfg });
    const wknds = identifyWeekends(fullCycle.startDate, fullCycle.endDate, holidays);
    const twoWknds = wknds.filter(w => {
      const e = resCad.assignments[w.saturday];
      return e && (e.am === 'm2' || e.pm === 'm2');
    });
    assert(twoWknds.length >= 18, `8d AM/PM TWO cadence=2 must work >= 18 weekends (got ${twoWknds.length})`);
    const confCad = flatConflicts(fullCycle, rosterCad, [], resCad.assignments, cfg);
    assert.strictEqual(confCad.filter(c => c.type === 'ERROR' || c.type === 'WARNING').length, 0, '8d AM/PM cadence=2 zero errors/warnings');
  }

  // 8e. 7-Day Weekly Rotation (weekly_rotation preset, 5FT + 1ALT)
  {
    const cfg = createUnitConfig('weekly_rotation');
    const res = solveSchedule(fullCycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const conf = flatConflicts(fullCycle, roster5, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, '8e weekly_rotation zero ERRORs');
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, `8e weekly_rotation zero WARNINGs (got ${JSON.stringify(conf.filter(c => c.type === 'WARNING'))})`);
    assert.strictEqual(conf.filter(c => c.code === 'MULTI_SHIFT_FT').length, 0, '8e weekly_rotation zero MULTI_SHIFT_FT false positives');

    const rH1 = solveSchedule(h1Cycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const rH2 = solveSchedule(h2Cycle, roster5, [], holidays, {}, [], { unitConfig: cfg, priorAssignments: rH1.assignments });
    assert.notStrictEqual(rH1.assignments['2027-06-30'], rH2.assignments['2027-07-01'], '8e weekly_rotation H1->H2 boundary week must not repeat same worker');
  }

  // 8f. Custom Block Thu-Sat (5FT + 1ALT)
  {
    const cfg = createUnitConfig('blank_psp', {
      rules: { blockPattern: 'custom_block', customBlockDows: [4, 5, 6], restPattern: 'mon_tue_off' }
    });
    const res = solveSchedule(fullCycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const conf = flatConflicts(fullCycle, roster5, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, `8f Thu-Sat custom_block zero ERRORs (got ${JSON.stringify(conf.filter(c => c.type === 'ERROR').slice(0, 3))})`);
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, `8f Thu-Sat custom_block zero WARNINGs (got ${JSON.stringify(conf.filter(c => c.type === 'WARNING').slice(0, 3))})`);
  }

  // 8g. Daily Independent (5FT + 1ALT)
  {
    const cfg = createUnitConfig('blank_psp', { rules: { blockPattern: 'daily_independent' } });
    const res = solveSchedule(fullCycle, roster5, [], holidays, {}, [], { unitConfig: cfg });
    const conf = flatConflicts(fullCycle, roster5, [], res.assignments, cfg);
    assert.strictEqual(conf.filter(c => c.type === 'ERROR').length, 0, `8g daily_independent zero ERRORs (got ${JSON.stringify(conf.filter(c => c.type === 'ERROR'))})`);
    assert.strictEqual(conf.filter(c => c.type === 'WARNING').length, 0, `8g daily_independent zero WARNINGs (got ${JSON.stringify(conf.filter(c => c.type === 'WARNING').slice(0, 3))})`);
    const totals = countMemberTotals(res.assignments, roster5);
    assert(ftSpread(totals, roster5) <= 3, `8g daily_independent FT spread <= 3 (got ${ftSpread(totals, roster5)}: ${JSON.stringify(totals)})`);
  }

  // 8h. Built HTML & UI modal checks (v1.3.0)
  {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert(!html.includes('Troop H Fire Marshal Unit Schedule'), '8h index.html must not contain hardcoded Troop H Fire Marshal Unit Schedule');
    assert(!html.includes('Alternate Fire Marshal'), '8h index.html must not contain hardcoded Alternate Fire Marshal');
    assert(html.includes('isMultiSlotConfig(cfg)'), '8h index.html reassign modal must check isMultiSlotConfig before showing times');
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert(fs.existsSync(new URL(`../On Call Schedule v${pkg.version}.html`, import.meta.url)), `8h On Call Schedule v${pkg.version}.html must exist`);
  }
}
console.log('PASS v1.3.0 regression suite verified');

