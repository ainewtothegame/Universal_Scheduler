import { createInitialAppState } from '../src/domain_data.js';
import { solveSchedule, identifyWeekends } from '../src/csp_solver.js';

const s = createInitialAppState();
const cycle = s.cycles['2027-H1'];
const weekends = identifyWeekends(cycle.startDate, cycle.endDate, s.holidays);
let failed = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; };

// Requests: Wolfe on weekend 5 and 9, Polcha on 6 (adjacent to a different person is fine),
// Terek on 7 and 8 (back-to-back -> second must be skipped), Reed (ALT) on 12,
// Wolfe on 5 conflicts with nothing. Polcha also requests weekend 5 (taken -> skipped).
const f = i => weekends[i].friday;
const prefs = [
  { id: 'a', memberId: 'wolfe', weekendFriday: f(4) },
  { id: 'b', memberId: 'wolfe', weekendFriday: f(9) },
  { id: 'c', memberId: 'polcha', weekendFriday: f(5) },
  { id: 'd', memberId: 'terek', weekendFriday: f(6) },
  { id: 'e', memberId: 'terek', weekendFriday: f(7) },
  { id: 'g', memberId: 'reed', weekendFriday: f(11) },
  { id: 'h', memberId: 'polcha', weekendFriday: f(4) }
];

const r = solveSchedule(cycle, s.roster, s.blackouts, s.holidays, {}, prefs);
const who = i => r.assignments[weekends[i].saturday];

check('Wolfe gets requested weekend 5', who(4) === 'wolfe');
check('Wolfe gets requested weekend 10', who(9) === 'wolfe');
check('Polcha gets requested weekend 6', who(5) === 'polcha');
check('Terek gets requested weekend 7', who(6) === 'terek');
check('Back-to-back Terek request skipped', who(7) !== 'terek');
check('Reed (ALT) gets requested weekend 12', who(11) === 'reed');
check('Duplicate request for weekend 5 reported', r.preferenceWarnings.some(w => w.startsWith('POLCHA') && w.includes(f(4))));
check('Two warnings total', r.preferenceWarnings.length === 2);
let consecutive = 0;
for (let i = 1; i < weekends.length; i++) if (who(i) && who(i) === who(i - 1)) consecutive++;
check('No back-to-back weekends anywhere', consecutive === 0);
check('All weekends staffed', weekends.every((w, i) => who(i)));

// No preferences -> same behavior as before
const r0 = solveSchedule(cycle, s.roster, s.blackouts, s.holidays, {});
check('No-prefs run has no warnings', r0.preferenceWarnings.length === 0);

process.exit(failed ? 1 : 0);


