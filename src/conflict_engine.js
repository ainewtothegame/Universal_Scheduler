/**
 * conflict_engine.js
 * Real-time constraint, fatigue, and contractual rule evaluator.
 */

import { parseDate, formatDate, addDays, getDayOfWeek } from './domain_data.js';
import { identifyWeekends, isMemberBlackedOut, isMemberActive } from './csp_solver.js';

export function evaluateScheduleConflicts(cycle, roster, blackouts, holidays, assignments) {
  const conflicts = {}; // dateStr -> Array of { type: 'ERROR'|'WARNING'|'ATTENTION', code, message }
  const weekends = identifyWeekends(cycle.startDate, cycle.endDate, holidays);

  function addConflict(dateStr, type, code, message) {
    if (!conflicts[dateStr]) conflicts[dateStr] = [];
    conflicts[dateStr].push({ type, code, message });
  }

  // 1. Blackout Clashes & Tenure Boundary Violations
  Object.entries(assignments).forEach(([dateStr, memberId]) => {
    if (!memberId) return;
    const member = roster.find(m => m.id === memberId);
    if (!member) {
      addConflict(dateStr, 'WARNING', 'UNKNOWN_MEMBER', `Assigned member ID '${memberId}' is not found in roster.`);
      return;
    }

    // Check tenure boundary
    if (!isMemberActive(member, dateStr)) {
      addConflict(
        dateStr,
        'ERROR',
        'TENURE_BOUNDARY_VIOLATION',
        `${member.name} is not active on ${dateStr} (active: ${member.activeStart} to ${member.activeEnd || 'present'}).`
      );
    }

    // Check blackout clash
    if (isMemberBlackedOut(memberId, dateStr, blackouts)) {
      addConflict(
        dateStr,
        'ERROR',
        'BLACKOUT_CLASH',
        `${member.name} has an approved blackout on ${dateStr}.`
      );
    }

    // Check Alternate Weekday Assignment (Mon–Thu outside attached holiday)
    const dow = getDayOfWeek(dateStr);
    if (member.role === 'ALT' && dow >= 1 && dow <= 4) {
      const isAttachedMon = holidays.some(h => h.date === dateStr && h.type === 'attached_mon');
      if (!isAttachedMon) {
        addConflict(
          dateStr,
          'ERROR',
          'ALT_WEEKDAY_VIOLATION',
          `Alternate ${member.name} cannot be assigned to regular weekday ${dateStr} without administrative exemption.`
        );
      }
    }
  });

  // 2. Post-Weekend Compensatory Rest Invariants
  weekends.forEach(w => {
    const workerId = assignments[w.saturday];
    const worker = roster.find(m => m.id === workerId);
    if (worker && worker.role === 'FT') {
      const wedStr = formatDate(addDays(w.friday, 5));
      const thuStr = formatDate(addDays(w.friday, 6));

      if (assignments[wedStr] === worker.id) {
        addConflict(
          wedStr,
          'ERROR',
          'REST_VIOLATION',
          `Post-Weekend Rest Violation: ${worker.name} worked weekend ${w.friday} and is prohibited on Wednesday ${wedStr}.`
        );
      }
      if (assignments[thuStr] === worker.id) {
        addConflict(
          thuStr,
          'ERROR',
          'REST_VIOLATION',
          `Post-Weekend Rest Violation: ${worker.name} worked weekend ${w.friday} and is prohibited on Thursday ${thuStr}.`
        );
      }
    }
  });

  // 3. Consecutive Weekend Violations
  for (let i = 0; i < weekends.length - 1; i++) {
    const w1 = weekends[i];
    const w2 = weekends[i + 1];
    const worker1 = assignments[w1.saturday];
    const worker2 = assignments[w2.saturday];

    if (worker1 && worker2 && worker1 === worker2) {
      const mem = roster.find(m => m.id === worker1);
      const name = mem?.name || worker1;
      addConflict(
        w2.friday,
        'WARNING',
        'CONSECUTIVE_WEEKEND',
        `${name} is assigned to consecutive weekends (${w1.friday} and ${w2.friday}).`
      );
    }
  }

  // 4. Alternate Quota Over-Allocation (enforced per 6-month half, as in the spec)
  const altCounts = {};
  weekends.forEach(w => {
    const workerId = assignments[w.saturday];
    const mem = roster.find(m => m.id === workerId);
    if (!mem || mem.role !== 'ALT') return;
    const cycleYear = cycle.year || (cycle.startDate ? parseInt(cycle.startDate.slice(0, 4), 10) : 2027);
    const half = (cycle.blockType === 'H1' || cycle.blockType === 'H2')
      ? cycle.blockType
      : (w.saturday < `${cycleYear}-07-01` ? 'H1' : 'H2');
    const key = `${cycleYear}-${half}-${workerId}`;
    altCounts[key] = (altCounts[key] || 0) + 1;
    const maxAllowed = (mem.weekendsPerSixMonths !== undefined && mem.weekendsPerSixMonths !== null && !isNaN(Number(mem.weekendsPerSixMonths)))
      ? Math.max(0, parseInt(mem.weekendsPerSixMonths, 10))
      : 3;
    if (altCounts[key] > maxAllowed) {
      addConflict(
        w.friday,
        'WARNING',
        'ALT_QUOTA_EXCEEDED',
        `Alternate ${mem.name} exceeds weekend quota (${altCounts[key]}/${maxAllowed} for ${half}).`
      );
    }
  });

  // 4b. Daily coverage: every day in the cycle needs exactly one assignee.
  // Skipped for a completely empty schedule so a fresh cycle is not flooded with warnings.
  if (Object.keys(assignments).some(d => d >= cycle.startDate && d <= cycle.endDate && assignments[d])) {
    let cov = parseDate(cycle.startDate);
    const covEnd = parseDate(cycle.endDate);
    while (cov <= covEnd) {
      const ds = formatDate(cov);
      if (!assignments[ds]) {
        addConflict(ds, 'WARNING', 'UNASSIGNED_DAY', `No one is assigned to on-call duty on ${ds}.`);
      }
      cov.setDate(cov.getDate() + 1);
    }
  }

  // 5. Multi-Shift Weekday Coverage (Attention Badge)
  // Group days into calendar weeks
  let walker = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const weekMap = {}; // weekKey -> Array of { dateStr, memberId }

  while (walker <= end) {
    const dateStr = formatDate(walker);
    const dow = walker.getDay();
    // Weekdays Mon(1) to Thu(4)
    if (dow >= 1 && dow <= 4) {
      // Find Monday of this week
      const monStr = formatDate(addDays(walker, -(dow - 1)));
      if (!weekMap[monStr]) weekMap[monStr] = [];
      if (assignments[dateStr]) {
        weekMap[monStr].push({ dateStr, memberId: assignments[dateStr] });
      }
    }
    walker.setDate(walker.getDate() + 1);
  }

  Object.values(weekMap).forEach(dayList => {
    const ftCounts = {};
    dayList.forEach(({ memberId }) => {
      const mem = roster.find(m => m.id === memberId);
      if (mem && mem.role === 'FT') {
        ftCounts[memberId] = (ftCounts[memberId] || 0) + 1;
      }
    });

    Object.entries(ftCounts).forEach(([memberId, count]) => {
      if (count >= 2) {
        const mem = roster.find(m => m.id === memberId);
        dayList.filter(d => d.memberId === memberId).forEach(({ dateStr }) => {
          addConflict(
            dateStr,
            'ATTENTION',
            'MULTI_SHIFT_FT',
            `${mem?.name} is covering ${count} mid-week shifts during this week.`
          );
        });
      }
    });
  });

  return conflicts;
}
