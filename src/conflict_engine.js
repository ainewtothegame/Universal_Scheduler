/**
 * conflict_engine.js
 * Configurable real-time constraint, PSP 80-hour biweekly fatigue, and rule evaluator.
 */

import { parseDate, formatDate, addDays, getDayOfWeek } from './domain_data.js';
import { identifyWeekends, isMemberBlackedOut, isMemberActive } from './csp_solver.js';
import {
  createUnitConfig,
  normalizeUnitConfig,
  isMultiSlotConfig,
  getActiveSlotsForDate,
  getSlotMember,
  getDayAssignedEntries,
  getRestBlockedDows,
  getRoleConfig,
  DAY_SHORT
} from './unit_config.js';

export function evaluateScheduleConflicts(cycle, roster, blackouts, holidays, assignments, rawUnitConfig = null) {
  const unitConfig = normalizeUnitConfig(rawUnitConfig || createUnitConfig('fire_marshal'));
  const multiSlot = isMultiSlotConfig(unitConfig);
  const rules = unitConfig.rules;
  const minGap = Math.max(0, parseInt(rules.minWeekendGap ?? 1, 10) || 0);
  const midweekBlockedSet = new Set(getRestBlockedDows(unitConfig).midweekBlocked);
  const conflicts = {}; // dateStr -> Array of { type: 'ERROR'|'WARNING'|'ATTENTION', code, message, slotId? }
  const weekends = identifyWeekends(cycle.startDate, cycle.endDate, holidays);

  function addConflict(dateStr, type, code, message, slotId = null) {
    if (!conflicts[dateStr]) conflicts[dateStr] = [];
    conflicts[dateStr].push({ type, code, message, slotId });
  }

  // 1. Per-Date & Per-Slot Checks (Tenure, Blackout, Role Eligibility, Same-Day AM/PM)
  Object.keys(assignments || {}).forEach(dateStr => {
    const entries = getDayAssignedEntries(assignments, dateStr, unitConfig);
    if (entries.length === 0) return;

    const dow = getDayOfWeek(dateStr);
    const isHoliday = (holidays || []).some(h => h.date === dateStr);
    const isAttachedMon = (holidays || []).some(h => h.date === dateStr && h.type === 'attached_mon');
    const seenMembersOnDay = new Map();

    entries.forEach(({ slotId, memberId }) => {
      const member = roster.find(m => m.id === memberId);
      if (!member) {
        addConflict(dateStr, 'WARNING', 'UNKNOWN_MEMBER', `Assigned member ID '${memberId}' is not found in roster.`, slotId);
        return;
      }

      if (!isMemberActive(member, dateStr)) {
        addConflict(
          dateStr,
          'ERROR',
          'TENURE_BOUNDARY_VIOLATION',
          `${member.name} is not active on ${dateStr} (active: ${member.activeStart || 'start'} to ${member.activeEnd || 'present'}).`,
          slotId
        );
      }

      if (isMemberBlackedOut(memberId, dateStr, blackouts)) {
        addConflict(
          dateStr,
          'ERROR',
          'BLACKOUT_CLASH',
          `${member.name} has an approved blackout on ${dateStr}.`,
          slotId
        );
      }

      const roleCfg = getRoleConfig(unitConfig, member.role);
      if (Array.isArray(roleCfg.allowedSlotIds) && roleCfg.allowedSlotIds.length > 0 && !roleCfg.allowedSlotIds.includes(slotId)) {
        addConflict(
          dateStr,
          'ERROR',
          'ROLE_SLOT_VIOLATION',
          `${member.name} (${roleCfg.label}) is not permitted on ${slotId} shift.`,
          slotId
        );
      }

      if (!roleCfg.canWorkWeekdays && dow >= 1 && dow <= 4 && !isAttachedMon) {
        const code = member.role === 'ALT' ? 'ALT_WEEKDAY_VIOLATION' : 'ROLE_WEEKDAY_VIOLATION';
        addConflict(
          dateStr,
          'ERROR',
          code,
          `${roleCfg.label} ${member.name} cannot be assigned to regular weekday ${dateStr} without administrative exemption.`,
          slotId
        );
      }

      if (!roleCfg.canWorkWeekends && (dow === 5 || dow === 6 || dow === 0)) {
        addConflict(
          dateStr,
          'ERROR',
          'ROLE_WEEKEND_VIOLATION',
          `${roleCfg.label} ${member.name} is not permitted on weekend shifts (${dateStr}).`,
          slotId
        );
      }

      if (!roleCfg.canWorkHolidays && isHoliday) {
        addConflict(
          dateStr,
          'WARNING',
          'ROLE_HOLIDAY_VIOLATION',
          `${roleCfg.label} ${member.name} is assigned on a holiday (${dateStr}).`,
          slotId
        );
      }

      if (multiSlot && !rules.allowSamePersonAmPm) {
        if (seenMembersOnDay.has(memberId)) {
          addConflict(
            dateStr,
            'ERROR',
            'AM_PM_SAME_DAY',
            `${member.name} is assigned to multiple shift slots (${seenMembersOnDay.get(memberId)} & ${slotId}) on ${dateStr}.`,
            null
          );
        } else {
          seenMembersOnDay.set(memberId, slotId);
        }
      }
    });
  });

  // 2. Post-Weekend Compensatory Rest Invariants (Driven by unitConfig.rules.restPattern)
  if (midweekBlockedSet.size > 0 && rules.blockPattern !== 'daily_independent') {
    weekends.forEach(w => {
      const weekendWorkers = new Set(
        getDayAssignedEntries(assignments, w.saturday, unitConfig).map(e => e.memberId)
      );
      weekendWorkers.forEach(workerId => {
        const worker = roster.find(m => m.id === workerId);
        if (!worker) return;
        // Fire Marshal quota-role alternates don't trigger FT midweek comp-rest in FM preset
        if (rules.restPattern === 'fire_marshal_thu_sun' && getRoleConfig(unitConfig, worker.role).quotaEnabled) return;

        midweekBlockedSet.forEach(blockedDow => {
          // Offset from Friday: Mon=3, Tue=4, Wed=5, Thu=6
          const offset = (blockedDow - 5 + 7) % 7;
          const restDateStr = formatDate(addDays(w.friday, offset));
          const entriesOnRest = getDayAssignedEntries(assignments, restDateStr, unitConfig);
          if (entriesOnRest.some(e => e.memberId === worker.id)) {
            addConflict(
              restDateStr,
              'ERROR',
              'REST_VIOLATION',
              `Post-Weekend Rest Violation: ${worker.name} worked weekend ${w.friday} and is prohibited on ${DAY_SHORT[blockedDow]} ${restDateStr}.`
            );
          }
        });
      });
    });
  }

  // 3. Consecutive Weekend / Minimum Gap Violations
  if (minGap > 0 && rules.blockPattern !== 'daily_independent') {
    for (let i = 0; i < weekends.length; i++) {
      const w1 = weekends[i];
      const workers1 = new Set(getDayAssignedEntries(assignments, w1.saturday, unitConfig).map(e => e.memberId));
      if (workers1.size === 0) continue;

      for (let g = 1; g <= minGap && i + g < weekends.length; g++) {
        const w2 = weekends[i + g];
        const workers2 = new Set(getDayAssignedEntries(assignments, w2.saturday, unitConfig).map(e => e.memberId));
        workers1.forEach(workerId => {
          if (workers2.has(workerId)) {
            const mem = roster.find(m => m.id === workerId);
            const name = mem?.name || workerId;
            addConflict(
              w2.friday,
              'WARNING',
              'CONSECUTIVE_WEEKEND',
              `${name} is assigned to weekends within ${g} week(s) (${w1.friday} and ${w2.friday}).`
            );
          }
        });
      }
    }
  }

  // 3b. PSP 80-Hour Biweekly Pay Period Check (2 weekends in same 14-day pay period)
  if (rules.enforce80HourCap && rules.payPeriodAnchorMonday) {
    const anchorMs = parseDate(rules.payPeriodAnchorMonday).getTime();
    const MS_PER_14_DAYS = 14 * 24 * 60 * 60 * 1000;
    const periodWeekendMap = {}; // `${periodIdx}|${memberId}` -> Array<fridayStr>
    weekends.forEach(w => {
      const pIdx = Math.floor((parseDate(w.friday).getTime() - anchorMs) / MS_PER_14_DAYS);
      const workers = new Set(getDayAssignedEntries(assignments, w.saturday, unitConfig).map(e => e.memberId));
      workers.forEach(mId => {
        const key = `${pIdx}|${mId}`;
        if (!periodWeekendMap[key]) periodWeekendMap[key] = [];
        periodWeekendMap[key].push(w.friday);
        if (periodWeekendMap[key].length > 1) {
          const mem = roster.find(m => m.id === mId);
          addConflict(
            w.friday,
            'WARNING',
            'PAY_PERIOD_80HR_RISK',
            `80-Hr Pay Period Alert: ${mem?.name || mId} is scheduled on multiple weekends (${periodWeekendMap[key].join(' & ')}) within the same 14-day pay period.`
          );
        }
      });
    });
  }

  // 4. Quota Over-Allocation (enforced per 6-month half for any quota-enabled role)
  const quotaCounts = {};
  weekends.forEach(w => {
    const workers = new Set(getDayAssignedEntries(assignments, w.saturday, unitConfig).map(e => e.memberId));
    workers.forEach(workerId => {
      const mem = roster.find(m => m.id === workerId);
      if (!mem) return;
      const roleCfg = getRoleConfig(unitConfig, mem.role);
      if (!roleCfg.quotaEnabled) return;

      const cycleYear = cycle.year || (cycle.startDate ? parseInt(cycle.startDate.slice(0, 4), 10) : 2027);
      const half = (cycle.blockType === 'H1' || cycle.blockType === 'H2')
        ? cycle.blockType
        : (w.saturday < `${cycleYear}-07-01` ? 'H1' : 'H2');
      const key = `${cycleYear}-${half}-${workerId}`;
      quotaCounts[key] = (quotaCounts[key] || 0) + 1;
      const defaultQ = roleCfg.defaultQuotaPerSixMonths ?? 3;
      const maxAllowed = (mem.weekendsPerSixMonths !== undefined && mem.weekendsPerSixMonths !== null && !isNaN(Number(mem.weekendsPerSixMonths)))
        ? Math.max(0, parseInt(mem.weekendsPerSixMonths, 10))
        : defaultQ;
      if (quotaCounts[key] > maxAllowed) {
        addConflict(
          w.friday,
          'WARNING',
          'ALT_QUOTA_EXCEEDED',
          `${roleCfg.label} ${mem.name} exceeds weekend quota (${quotaCounts[key]}/${maxAllowed} for ${half}).`
        );
      }
    });
  });

  // 4b. Daily coverage: every active slot on every day in the cycle needs an assignee.
  const hasAnyAssignment = Object.keys(assignments || {}).some(d => d >= cycle.startDate && d <= cycle.endDate && getDayAssignedEntries(assignments, d, unitConfig).length > 0);
  if (hasAnyAssignment) {
    let cov = parseDate(cycle.startDate);
    const covEnd = parseDate(cycle.endDate);
    while (cov <= covEnd) {
      const ds = formatDate(cov);
      const activeSlots = getActiveSlotsForDate(ds, unitConfig, holidays);
      activeSlots.forEach(slot => {
        if (!getSlotMember(assignments, ds, slot.id, unitConfig)) {
          addConflict(ds, 'WARNING', 'UNASSIGNED_DAY', `No one is assigned to ${slot.label} on ${ds}.`, slot.id);
        }
      });
      cov.setDate(cov.getDate() + 1);
    }
  }

  // 5. Multi-Shift Weekday Coverage (Attention Badge)
  if (!multiSlot) {
    let walker = parseDate(cycle.startDate);
    const end = parseDate(cycle.endDate);
    const weekMap = {};

    while (walker <= end) {
      const dateStr = formatDate(walker);
      const dow = walker.getDay();
      if (dow >= 1 && dow <= 4) {
        const monStr = formatDate(addDays(walker, -(dow - 1)));
        if (!weekMap[monStr]) weekMap[monStr] = [];
        const entries = getDayAssignedEntries(assignments, dateStr, unitConfig);
        if (entries.length > 0) {
          weekMap[monStr].push({ dateStr, memberId: entries[0].memberId });
        }
      }
      walker.setDate(walker.getDate() + 1);
    }

    Object.values(weekMap).forEach(dayList => {
      const ftCounts = {};
      dayList.forEach(({ memberId }) => {
        const mem = roster.find(m => m.id === memberId);
        if (mem && !getRoleConfig(unitConfig, mem.role).quotaEnabled) {
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
  }

  return conflicts;
}

/**
 * Unified manual-assignment validation helper shared by the Reassign modal and conflict preview.
 */
export function evaluateManualSlotAssignment(dateStr, slotId, memberId, cycle, roster, blackouts, holidays, rawUnitConfig = null) {
  if (!memberId) return [];
  const unitConfig = normalizeUnitConfig(rawUnitConfig || createUnitConfig('fire_marshal'));
  const mem = roster.find(m => m.id === memberId);
  if (!mem) return [];

  const testAssignments = JSON.parse(JSON.stringify(cycle.assignments || {}));
  if (isMultiSlotConfig(unitConfig)) {
    const cur = (testAssignments[dateStr] && typeof testAssignments[dateStr] === 'object') ? { ...testAssignments[dateStr] } : {};
    cur[slotId] = memberId;
    testAssignments[dateStr] = cur;
  } else {
    testAssignments[dateStr] = memberId;
  }

  const allConflicts = evaluateScheduleConflicts(cycle, roster, blackouts, holidays, testAssignments, unitConfig);
  const dayList = allConflicts[dateStr] || [];
  return dayList
    .filter(c => c.code !== 'UNASSIGNED_DAY' && c.code !== 'MULTI_SHIFT_FT' && (!c.slotId || c.slotId === slotId))
    .map(c => ({
      type: c.code,
      severity: c.type === 'ERROR' ? 'ERROR' : 'WARNING',
      message: c.message
    }));
}
