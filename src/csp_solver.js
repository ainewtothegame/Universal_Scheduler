/**
 * csp_solver.js
 * Configurable Constraint Satisfaction Problem (CSP) Solver for PSP Universal Scheduler.
 * Supports single-slot and AM/PM multi-slot schedules, Fire Marshal 5-stage parity,
 * 7-day full-week rotations, daily independent shifts, and PSP 80-hour rest patterns.
 */

import { formatDate, parseDate, addDays, getDayOfWeek, isPremiumHoliday } from './domain_data.js';
import {
  createUnitConfig,
  normalizeUnitConfig,
  isMultiSlotConfig,
  getPrimarySlotId,
  isSlotActiveOnDate,
  getActiveSlotsForDate,
  getSlotMember,
  setSlotMember,
  getRestBlockedDows,
  getRoleConfig
} from './unit_config.js';

/**
 * Checks if a member has an approved blackout on a given date string ('YYYY-MM-DD').
 */
export function isMemberBlackedOut(memberId, dateStr, blackouts) {
  return blackouts.some(b => {
    if (b.memberId !== memberId) return false;
    return dateStr >= b.startDate && dateStr <= b.endDate;
  });
}

/**
 * Checks if a member is active on a given date string ('YYYY-MM-DD').
 */
export function isMemberActive(member, dateStr) {
  if (!member) return false;
  if (member.activeStart && dateStr < member.activeStart) return false;
  if (member.activeEnd && dateStr > member.activeEnd) return false;
  return true;
}

/**
 * Identifies all weekend objects within a date range.
 */
export function identifyWeekends(startDateStr, endDateStr, holidays) {
  const weekends = [];
  let curr = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  const startDow = curr.getDay();
  if (startDow === 6) {
    curr = addDays(curr, -1);
  } else if (startDow === 0) {
    curr = addDays(curr, -2);
  } else if (startDow === 1) {
    const isAttMon = (holidays || []).some(h => h.date === startDateStr && h.type === 'attached_mon');
    if (isAttMon) curr = addDays(curr, -3);
  }

  while (curr <= end) {
    if (curr.getDay() === 5) {
      const fri = formatDate(curr);
      const sat = formatDate(addDays(curr, 1));
      const sun = formatDate(addDays(curr, 2));
      const mon = formatDate(addDays(curr, 3));

      const friHoliday = (holidays || []).find(h => h.date === fri && h.type === 'attached_fri');
      const monHoliday = (holidays || []).find(h => h.date === mon && h.type === 'attached_mon');
      const phase = fri < '2027-03-01' ? 1 : 2;

      weekends.push({
        index: weekends.length,
        friday: fri,
        saturday: sat,
        sunday: sun,
        monday: mon,
        attachedFriday: friHoliday ? friHoliday.date : null,
        attachedMonday: monHoliday ? monHoliday.date : null,
        phase,
        dates: [fri, sat, sun]
      });
    }
    curr.setDate(curr.getDate() + 1);
  }

  return weekends;
}

/**
 * Identifies 7-day weeks aligned to weekStartDay (1=Monday, 0=Sunday).
 */
export function identifyWeeks(startDateStr, endDateStr, weekStartDay = 1) {
  const weeks = [];
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  const startDow = start.getDay();
  const offset = (startDow - weekStartDay + 7) % 7;
  let curr = addDays(start, -offset);

  while (curr <= end) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(formatDate(addDays(curr, i)));
    }
    weeks.push({
      index: weeks.length,
      startDate: days[0],
      endDate: days[6],
      days
    });
    curr = addDays(curr, 7);
  }
  return weeks;
}

function memberAllowedForSlot(member, roleCfg, slotId) {
  if (!roleCfg) return true;
  if (Array.isArray(roleCfg.allowedSlotIds) && roleCfg.allowedSlotIds.length > 0) {
    return roleCfg.allowedSlotIds.includes(slotId);
  }
  return true;
}

function getAllDays(startDateStr, endDateStr) {
  const out = [];
  let w = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  while (w <= end) {
    out.push(formatDate(w));
    w.setDate(w.getDate() + 1);
  }
  return out;
}

function getMemberTargetCadence(mem) {
  if (!mem) return null;
  if (mem.weekendCadence !== undefined && mem.weekendCadence !== null && mem.weekendCadence !== '') {
    const cad = parseInt(mem.weekendCadence, 10);
    return (!isNaN(cad) && cad >= 2) ? cad : null;
  }
  if (mem.minWeekendGap !== undefined && mem.minWeekendGap !== null && mem.minWeekendGap !== '') {
    const g = parseInt(mem.minWeekendGap, 10);
    if (!isNaN(g) && g >= 1 && g <= 3) return g + 1;
  }
  return null;
}

/**
 * Master Configurable CSP Solver
 */
export function solveSchedule(cycle, roster, blackouts, holidays, manualOverrides = {}, preferredWeekends = [], context = {}) {
  const unitConfig = normalizeUnitConfig(context.unitConfig || createUnitConfig('fire_marshal'));
  const multiSlot = isMultiSlotConfig(unitConfig);
  const blockPattern = unitConfig.rules.blockPattern || 'fri_mon_ft';
  const isCustomFriSun = blockPattern === 'custom_block' &&
    JSON.stringify([...(unitConfig.rules.customBlockDows || [5, 6, 0])].map(Number).sort((a, b) => a - b)) === '[0,5,6]';

  if (!multiSlot && isCustomFriSun) {
    const normalizedCfg = normalizeUnitConfig({ ...unitConfig, rules: { ...unitConfig.rules, blockPattern: 'fri_sun' } });
    return solveSingleSlotWeekendWeekday(cycle, roster, blackouts, holidays, manualOverrides, preferredWeekends, context, normalizedCfg);
  }

  if (multiSlot || blockPattern === 'full_week' || blockPattern === 'daily_independent' || blockPattern === 'custom_block') {
    return solveConfigurableSchedule(cycle, roster, blackouts, holidays, manualOverrides, preferredWeekends, context, unitConfig);
  }

  return solveSingleSlotWeekendWeekday(cycle, roster, blackouts, holidays, manualOverrides, preferredWeekends, context, unitConfig);
}

/**
 * Parameterized Single-Slot 5-Stage Solver (preserves exact Fire Marshal parity when using fire_marshal preset).
 */
function solveSingleSlotWeekendWeekday(cycle, roster, blackouts, holidays, manualOverrides, preferredWeekends, context, unitConfig) {
  const primarySlot = unitConfig.coverageSlots[0];
  const primarySlotId = primarySlot.id;
  const rules = unitConfig.rules;
  const holRules = unitConfig.holidayRules;
  const weekdayMode = rules.weekdayMode || 'fire_marshal_phased_2027';
  const blockPattern = rules.blockPattern || 'fri_mon_ft';
  const minGap = Math.max(0, parseInt(rules.minWeekendGap ?? 1, 10) || 0);
  const midweekBlockedSet = new Set(getRestBlockedDows(unitConfig).midweekBlocked);
  const attachFriMon = holRules.attachFriMonHolidaysToWeekend !== false;
  const balanceHolidays = holRules.balanceHolidays !== false;

  const isPhase1Date = (dStr) => {
    if (weekdayMode === 'fire_marshal_phased_2027') return dStr < '2027-03-01';
    if (weekdayMode === 'fixed_baseline') return true;
    return false;
  };
  const isExtendedMonWeekend = (w) => {
    if (blockPattern !== 'fri_mon_ft') return false;
    if (weekdayMode === 'fire_marshal_phased_2027') return w.phase === 2;
    return true;
  };
  const isLookaheadWeekend = (w) => {
    if (!rules.proactiveAltLookahead) return false;
    if (weekdayMode === 'fire_marshal_phased_2027') return w.phase === 2;
    return true;
  };

  const lockedShifts = {};
  Object.entries(manualOverrides || {}).forEach(([d, val]) => {
    if (typeof val === 'string' && val) lockedShifts[d] = val;
    else if (val && typeof val === 'object' && typeof val[primarySlotId] === 'string' && val[primarySlotId]) {
      lockedShifts[d] = val[primarySlotId];
    }
  });
  const assignments = { ...lockedShifts };
  const diagnostics = {};
  const preferenceWarnings = [];
  const scheduleNotices = [];

  const activeFTs = roster.filter(m => !getRoleConfig(unitConfig, m.role).quotaEnabled && getRoleConfig(unitConfig, m.role).canWorkWeekdays);
  const activeALTs = roster.filter(m => getRoleConfig(unitConfig, m.role).quotaEnabled);
  const weekdayWorkers = roster.filter(m => getRoleConfig(unitConfig, m.role).canWorkWeekdays);
  const effectiveWeekdayPool = weekdayWorkers.length > 0 ? weekdayWorkers : activeFTs;

  const rawPrior = context.priorAssignments || {};
  const priorAssignments = {};
  Object.entries(rawPrior).forEach(([d, val]) => {
    const mId = typeof val === 'string' ? val : (val && typeof val === 'object' ? (val[primarySlotId] || Object.values(val).find(Boolean)) : null);
    if (mId) priorAssignments[d] = mId;
  });

  let priorLastWeekendWorker = null;
  let priorLastWeekendFriday = null;
  const priorRecentWeekendWorkers = [];

  const weekends = identifyWeekends(cycle.startDate, cycle.endDate, holidays);
  const cycleYear = cycle.year || (cycle.startDate ? parseInt(cycle.startDate.slice(0, 4), 10) : 2027);
  const halfOf = (w) => {
    if (cycle.blockType === 'H1') return `${cycleYear}H1`;
    if (cycle.blockType === 'H2') return `${cycleYear}H2`;
    if (cycle.blockType === 'FULL') return `${cycleYear}${w.saturday < `${cycleYear}-07-01` ? 'H1' : 'H2'}`;
    const yr = w.saturday.slice(0, 4);
    return `${yr}${w.saturday.slice(5) < '07-01' ? 'H1' : 'H2'}`;
  };
  const halves = (cycle.blockType === 'H1') ? [`${cycleYear}H1`]
    : (cycle.blockType === 'H2') ? [`${cycleYear}H2`]
    : (cycle.blockType === 'FULL') ? [`${cycleYear}H1`, `${cycleYear}H2`]
    : [...new Set(weekends.map(halfOf))];

  const altQuotaConsumed = {};
  const altTargetQuotas = {};
  activeALTs.forEach(a => {
    const roleDefault = getRoleConfig(unitConfig, a.role).defaultQuotaPerSixMonths ?? 3;
    const perHalf = (a.weekendsPerSixMonths !== undefined && a.weekendsPerSixMonths !== null && !isNaN(Number(a.weekendsPerSixMonths)))
      ? Math.max(0, parseInt(a.weekendsPerSixMonths, 10))
      : roleDefault;
    halves.forEach(h => {
      altQuotaConsumed[`${a.id}|${h}`] = 0;
      altTargetQuotas[`${a.id}|${h}`] = perHalf;
    });
  });

  const weekendAssignments = {};

  const priorDays = Object.keys(priorAssignments).filter(d => d < cycle.startDate).sort();
  if (priorDays.length > 0) {
    const priorStartDate = priorDays[0];
    const priorEndDate = priorDays[priorDays.length - 1];
    const priorWeekends = identifyWeekends(priorStartDate, priorEndDate, holidays);
    if (priorWeekends.length > 0) {
      const lastPW = priorWeekends[priorWeekends.length - 1];
      if (weekends.length > 0 && lastPW.friday === weekends[0].friday) {
        const w0Worker = priorAssignments[lastPW.saturday] || priorAssignments[lastPW.friday] || priorAssignments[lastPW.sunday];
        if (w0Worker && !weekendAssignments[0]) {
          weekendAssignments[0] = w0Worker;
          const mem = roster.find(m => m.id === w0Worker);
          if (mem && getRoleConfig(unitConfig, mem.role).quotaEnabled) {
            altQuotaConsumed[`${w0Worker}|${halfOf(weekends[0])}`] = (altQuotaConsumed[`${w0Worker}|${halfOf(weekends[0])}`] || 0) + 1;
          }
        }
        for (let k = priorWeekends.length - 2; k >= 0; k--) {
          const pw = priorWeekends[k];
          priorRecentWeekendWorkers.push(priorAssignments[pw.saturday] || priorAssignments[pw.friday] || priorAssignments[pw.sunday] || null);
        }
        if (priorWeekends.length > 1) {
          const penPW = priorWeekends[priorWeekends.length - 2];
          priorLastWeekendWorker = priorAssignments[penPW.saturday] || priorAssignments[penPW.friday] || priorAssignments[penPW.sunday];
          priorLastWeekendFriday = penPW.friday;
        }
      } else {
        for (let k = priorWeekends.length - 1; k >= 0; k--) {
          const pw = priorWeekends[k];
          priorRecentWeekendWorkers.push(priorAssignments[pw.saturday] || priorAssignments[pw.friday] || priorAssignments[pw.sunday] || null);
        }
        priorLastWeekendWorker = priorAssignments[lastPW.saturday] || priorAssignments[lastPW.friday] || priorAssignments[lastPW.sunday];
        priorLastWeekendFriday = lastPW.friday;
      }
    }
  }

  const getMemberMinGap = (memberId) => {
    const mem = roster.find(m => m.id === memberId);
    const cad = getMemberTargetCadence(mem);
    if (cad) return cad - 1;
    if (mem && mem.weekendCadence !== undefined && mem.weekendCadence !== null && mem.weekendCadence !== '') {
      const parsedCad = parseInt(mem.weekendCadence, 10);
      if (!isNaN(parsedCad)) return Math.max(0, parsedCad - 1);
    }
    if (mem && mem.minWeekendGap !== undefined && mem.minWeekendGap !== null && mem.minWeekendGap !== '') {
      const parsed = parseInt(mem.minWeekendGap, 10);
      if (!isNaN(parsed)) return Math.max(0, parsed);
    }
    return minGap;
  };

  const violatesWeekendGap = (wIdx, memberId, mapObj = weekendAssignments) => {
    const gap = getMemberMinGap(memberId);
    for (let g = 1; g <= gap; g++) {
      if (wIdx - g >= 0 && mapObj[wIdx - g] === memberId) return true;
      if (wIdx - g < 0) {
        const priorIdx = g - 1 - wIdx;
        if (priorRecentWeekendWorkers[priorIdx] === memberId) return true;
      }
      if (wIdx + g < weekends.length && mapObj[wIdx + g] === memberId) return true;
    }
    return false;
  };

  weekends.forEach(w => {
    let assignedId = assignments[w.saturday] || assignments[w.friday] || assignments[w.sunday];
    if (!assignedId && priorAssignments) {
      assignedId = priorAssignments[w.saturday] || priorAssignments[w.friday] || priorAssignments[w.sunday];
    }
    if (assignedId) {
      weekendAssignments[w.index] = assignedId;
      const mem = roster.find(m => m.id === assignedId);
      if (mem && getRoleConfig(unitConfig, mem.role).quotaEnabled) {
        altQuotaConsumed[`${assignedId}|${halfOf(w)}`] = (altQuotaConsumed[`${assignedId}|${halfOf(w)}`] || 0) + 1;
      }
    }
  });

  // STAGE 0: Lock Requested ("Want to Work") Weekends
  [...preferredWeekends]
    .sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday))
    .forEach(p => {
      const w = weekends.find(x => x.friday === p.weekendFriday);
      const mem = roster.find(m => m.id === p.memberId);
      if (!w || !mem) return;

      const skip = (reason) => {
        preferenceWarnings.push(`${mem.name} - weekend of ${w.friday}: ${reason}`);
      };

      if (weekendAssignments[w.index]) {
        const holder = roster.find(m => m.id === weekendAssignments[w.index]);
        if (holder && holder.id === mem.id) return;
        return skip(`already taken by ${holder ? holder.name : 'another member'}.`);
      }
      if (!isMemberActive(mem, w.friday) || !isMemberActive(mem, w.sunday)) {
        return skip('member is not active on those dates.');
      }
      const checkDates = [w.friday, w.saturday, w.sunday];
      if (attachFriMon && w.attachedMonday) checkDates.push(w.attachedMonday);
      if (attachFriMon && w.attachedFriday) checkDates.push(w.attachedFriday);
      if (!getRoleConfig(unitConfig, mem.role).quotaEnabled && isExtendedMonWeekend(w)) checkDates.push(w.monday);
      if (checkDates.some(d => isMemberBlackedOut(mem.id, d, blackouts))) {
        return skip('member has a blackout on those dates.');
      }
      if (violatesWeekendGap(w.index, mem.id)) {
        return skip('would be back-to-back with another weekend for the same person (rest rule).');
      }

      weekendAssignments[w.index] = mem.id;
      if (getRoleConfig(unitConfig, mem.role).quotaEnabled) {
        altQuotaConsumed[`${mem.id}|${halfOf(w)}`] = (altQuotaConsumed[`${mem.id}|${halfOf(w)}`] || 0) + 1;
      }
    });

  // Honor specific date requests (if any) on non-weekend days or unassigned slots
  const preferredDates = Array.isArray(context.preferredDates) ? context.preferredDates : [];
  preferredDates.forEach(pd => {
    if (!pd || !pd.date || !pd.memberId) return;
    if (pd.date < cycle.startDate || pd.date > cycle.endDate) return;
    if (assignments[pd.date]) return;
    const mem = roster.find(m => m.id === pd.memberId);
    if (!mem || !isMemberActive(mem, pd.date) || isMemberBlackedOut(mem.id, pd.date, blackouts)) return;
    if (!isSlotActiveOnDate(primarySlot, pd.date, holidays)) return;
    assignments[pd.date] = mem.id;
  });

  // Pre-calculate lookahead weekends (only when 1 FT on leave leaves <= 2 active FTs)
  const lookaheadWeekendFridays = new Set();
  const lookaheadMeta = new Map();
  if (rules.proactiveAltLookahead && activeALTs.length > 0) {
    const threshold = rules.lookaheadLeaveThreshold || 3;
    weekends.forEach(wk => {
      if (!isLookaheadWeekend(wk)) return;
      const midWeekDays = [0, 1, 2, 3].map(n => formatDate(addDays(wk.monday, n)));
      const activeThisWeek = activeFTs.filter(ft => isMemberActive(ft, wk.monday));
      const leaveFT = activeThisWeek.find(ft =>
        midWeekDays.filter(d => isMemberBlackedOut(ft.id, d, blackouts)).length >= threshold
      );
      const remainingActiveFTs = activeThisWeek.filter(ft =>
        midWeekDays.filter(d => isMemberBlackedOut(ft.id, d, blackouts)).length < threshold
      ).length;
      if (leaveFT && remainingActiveFTs <= 2) {
        lookaheadWeekendFridays.add(wk.friday);
        lookaheadMeta.set(wk.friday, { ftMember: leaveFT, weekend: wk });
      }
    });
  }

  // STAGE 1: Mandatory Alternate Weekends Before FT Leave
  if (rules.proactiveAltLookahead && activeALTs.length > 0) {
    weekends.forEach(w => {
      if (!isLookaheadWeekend(w) || weekendAssignments[w.index]) return;
      const meta = lookaheadMeta.get(w.friday);
      if (!meta) return;
      const ftOnLeave = meta.ftMember;
      const ftDisplayName = `${ftOnLeave.rank || unitConfig.defaultRank || 'Trooper'} ${ftOnLeave.firstName ? ftOnLeave.firstName + ' ' : ''}${ftOnLeave.name}`;

      const key = (alt) => `${alt.id}|${halfOf(w)}`;
      const candidates = activeALTs.filter(alt => {
        if (!isMemberActive(alt, w.friday)) return false;
        if (altQuotaConsumed[key(alt)] >= altTargetQuotas[key(alt)]) return false;
        if (violatesWeekendGap(w.index, alt.id)) return false;
        const checkDates = [w.friday, w.saturday, w.sunday];
        if (attachFriMon && w.attachedMonday) checkDates.push(w.attachedMonday);
        return !checkDates.some(d => isMemberBlackedOut(alt.id, d, blackouts));
      });
      candidates.sort((x, y) =>
        (altTargetQuotas[key(y)] - altQuotaConsumed[key(y)]) - (altTargetQuotas[key(x)] - altQuotaConsumed[key(x)]));

      const label = `${w.friday} to ${w.sunday}`;
      if (candidates.length > 0) {
        weekendAssignments[w.index] = candidates[0].id;
        altQuotaConsumed[key(candidates[0])] = (altQuotaConsumed[key(candidates[0])] || 0) + 1;
      } else {
        diagnostics[w.friday] = `Stage 1 Lookahead Warning: No rested Alternate available for lookahead weekend before ${ftOnLeave.name}'s leave.`;
        if (context.isSimulation) {
          scheduleNotices.push(`Stage 1 lookahead unstaffed for ${w.friday}`);
          return;
        }

        const withRequests = [...new Set(preferredWeekends
          .filter(p => { const pw = weekends.find(x => x.friday === p.weekendFriday); return pw && halfOf(pw) === halfOf(w); })
          .map(p => roster.find(m => m.id === p.memberId))
          .filter(m => m && getRoleConfig(unitConfig, m.role).quotaEnabled)
          .map(m => m.name))];

        const formatWkShort = (wk) => {
          const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const f = parseDate(wk.friday);
          const e = parseDate((attachFriMon && wk.attachedMonday) || wk.sunday);
          const mf = MONTHS[f.getMonth()];
          const me = MONTHS[e.getMonth()];
          return mf === me ? `${mf} ${f.getDate()}–${e.getDate()}` : `${mf} ${f.getDate()} – ${me} ${e.getDate()}`;
        };

        const targetLabel = formatWkShort(w);
        const cleanRecommendations = [];
        const secondaryOptions = [];
        const protectedWarnings = [];

        activeALTs.forEach(alt => {
          if (!isMemberActive(alt, w.friday) || !isMemberActive(alt, w.sunday)) return;
          const checkDates = [w.friday, w.saturday, w.sunday];
          if (attachFriMon && w.attachedMonday) checkDates.push(w.attachedMonday);
          if (attachFriMon && w.attachedFriday) checkDates.push(w.attachedFriday);
          if (checkDates.some(d => isMemberBlackedOut(alt.id, d, blackouts))) return;
          if (violatesWeekendGap(w.index, alt.id)) return;

          const altRank = alt.rank || unitConfig.defaultRank || 'Trooper';
          const altDisplayName = `${altRank} ${alt.firstName ? alt.firstName + ' ' : ''}${alt.name}`;
          const altReqs = preferredWeekends
            .filter(p => p.memberId === alt.id)
            .map(p => weekends.find(x => x.friday === p.weekendFriday))
            .filter(pw => pw && halfOf(pw) === halfOf(w));

          if (altReqs.length === 0) {
            const trialPrefs = [...preferredWeekends, { memberId: alt.id, weekendFriday: w.friday }];
            const trialRes = solveSchedule(cycle, roster, blackouts, holidays, lockedShifts, trialPrefs, { ...context, unitConfig, isSimulation: true });
            if (trialRes.scheduleNotices.length === 0 && trialRes.preferenceWarnings.length === 0) {
              cleanRecommendations.push(`${altDisplayName}: available for ${targetLabel} and could take this weekend without moving other requests.`);
            } else if (trialRes.scheduleNotices.length === 0) {
              secondaryOptions.push(`${altDisplayName}: available for ${targetLabel} and could take this weekend.`);
            }
            return;
          }

          const cleanDonorWeekends = [];
          const secondaryDonorWeekends = [];

          altReqs.forEach(pw => {
            if (lookaheadWeekendFridays.has(pw.friday)) {
              const lMeta = lookaheadMeta.get(pw.friday);
              const lFt = lMeta && lMeta.ftMember;
              const lFtDisplayName = lFt ? `${lFt.rank || unitConfig.defaultRank || 'Trooper'} ${lFt.firstName ? lFt.firstName + ' ' : ''}${lFt.name}` : 'full-time member';
              protectedWarnings.push(
                `${altDisplayName} requested ${formatWkShort(pw)}: protects schedule ahead of ${lFtDisplayName}'s leave. Switching away from ${formatWkShort(pw)} will create a new conflict.`
              );
              return;
            }

            const trialPrefs = preferredWeekends.map(p => {
              if (p.memberId === alt.id && p.weekendFriday === pw.friday) {
                return { ...p, weekendFriday: w.friday };
              }
              return p;
            });

            const trialRes = solveSchedule(cycle, roster, blackouts, holidays, lockedShifts, trialPrefs, { ...context, unitConfig, isSimulation: true });
            if (trialRes.scheduleNotices.length === 0 && trialRes.preferenceWarnings.length === 0) {
              cleanDonorWeekends.push(formatWkShort(pw));
            } else if (trialRes.scheduleNotices.length === 0) {
              secondaryDonorWeekends.push(formatWkShort(pw));
            }
          });

          if (cleanDonorWeekends.length > 0) {
            cleanRecommendations.push(
              `${altDisplayName}: could switch requested weekend ${cleanDonorWeekends.join(' or ')} to ${targetLabel}.`
            );
          }
          if (secondaryDonorWeekends.length > 0) {
            secondaryOptions.push(
              `${altDisplayName}: could switch requested weekend ${secondaryDonorWeekends.join(' or ')} to ${targetLabel}.`
            );
          }
        });

        let noticeText =
          `Weekend ${label} should be worked by an Alternate (${ftDisplayName} is off that following week, and the other full-time members cannot cover it without long stretches), ` +
          `but no Alternate has an open weekend: ` +
          (withRequests.length
            ? `their requested weekends already use their quota (${withRequests.join(', ')} have requests in this period)`
            : `their 6-month weekend quota is already filled`) +
          `. Please ask an Alternate whether they could give a different weekend or take this one, then run Auto-Generate again.`;

        if (cleanRecommendations.length > 0 || secondaryOptions.length > 0 || protectedWarnings.length > 0) {
          noticeText += '\n\nSuggested Weekend Switches:';
          if (cleanRecommendations.length > 0) {
            noticeText += '\n• Best Recommendation (verified conflict-free):\n' + cleanRecommendations.map(s => '  - ' + s).join('\n');
          }
          if (secondaryOptions.length > 0) {
            noticeText += '\n• Other Viable Options:\n' + secondaryOptions.map(s => '  - ' + s).join('\n');
          }
          if (protectedWarnings.length > 0) {
            noticeText += '\n• Protected Weekends (do NOT switch):\n' + protectedWarnings.map(s => '  - ' + s).join('\n');
          }
        }

        scheduleNotices.push(noticeText);
      }
    });
  }

  // STAGE 2: Alternate / Quota-Based Weekend Allocation (CSP via MRV)
  if (activeALTs.length > 0) {
    const unassignedWeekends = weekends.filter(w => !weekendAssignments[w.index]);
    const slots = [];
    activeALTs.forEach(a => halves.forEach(h => slots.push({ alt: a, half: h, key: `${a.id}|${h}` })));

    const SPREAD_TIERS = [
      { maxPerMonth: 1, allowAdjacentAlt: false, minSameAltGap: 5 },
      { maxPerMonth: 1, allowAdjacentAlt: false, minSameAltGap: 3 },
      { maxPerMonth: 1, allowAdjacentAlt: false, minSameAltGap: 2 },
      { maxPerMonth: 1, allowAdjacentAlt: true, minSameAltGap: 1 },
      { maxPerMonth: 2, allowAdjacentAlt: true, minSameAltGap: 1 },
      { maxPerMonth: Infinity, allowAdjacentAlt: true, minSameAltGap: 1 }
    ];
    const monthOf = (w) => w.friday.slice(0, 7);
    const altIds = new Set(activeALTs.map(a => a.id));
    const weekendsByHalf = {};
    weekends.forEach(w => { (weekendsByHalf[halfOf(w)] = weekendsByHalf[halfOf(w)] || []).push(w); });
    const idealPositions = (sl) => {
      const list = weekendsByHalf[sl.half] || [];
      const q = altTargetQuotas[sl.key];
      const altPos = activeALTs.findIndex(x => x.id === sl.alt.id);
      if (!q || !list.length) return [];
      const out = [];
      for (let k = 0; k < q; k++) out.push((k + (altPos + 0.5) / activeALTs.length) * (list.length / q));
      return out;
    };
    const idealCache = {};
    slots.forEach(sl => { idealCache[sl.key] = idealPositions(sl); });
    const indexInHalf = (w) => (weekendsByHalf[halfOf(w)] || []).indexOf(w);

    const MAX_SEARCH_STEPS = 200000;
    let searchSteps = 0;
    function solveAlternateWeekends(tier, currentAssignments, currentQuotas) {
      if (++searchSteps > MAX_SEARCH_STEPS) return false;
      const allQuotasMet = slots.every(sl => currentQuotas[sl.key] >= altTargetQuotas[sl.key]);
      if (allQuotasMet) return true;

      const monthCount = (altId, month) =>
        weekends.filter(x => currentAssignments[x.index] === altId && monthOf(x) === month).length;
      const neighbourIsAlt = (w) =>
        (w.index > 0 && altIds.has(currentAssignments[w.index - 1])) ||
        (w.index < weekends.length - 1 && altIds.has(currentAssignments[w.index + 1]));
      const violatesSameAltSpacing = (wIdx, altId) => {
        for (let g = 1; g <= tier.minSameAltGap; g++) {
          if (wIdx - g >= 0 && currentAssignments[wIdx - g] === altId) return true;
          if (wIdx + g < weekends.length && currentAssignments[wIdx + g] === altId) return true;
        }
        return false;
      };

      const unmet = slots
        .filter(sl => currentQuotas[sl.key] < altTargetQuotas[sl.key])
        .map(sl => {
          const alt = sl.alt;
          const eligibleWeekends = unassignedWeekends.filter(w => {
            if (halfOf(w) !== sl.half) return false;
            if (currentAssignments[w.index]) return false;
            if (!isMemberActive(alt, w.friday)) return false;
            if (!getRoleConfig(unitConfig, alt.role).canWorkWeekends) return false;
            if (violatesWeekendGap(w.index, alt.id, currentAssignments)) return false;
            if (violatesSameAltSpacing(w.index, alt.id)) return false;
            const datesToCheck = [w.friday, w.saturday, w.sunday];
            if (attachFriMon && w.attachedMonday) datesToCheck.push(w.attachedMonday);
            if (attachFriMon && w.attachedFriday) datesToCheck.push(w.attachedFriday);
            if (datesToCheck.some(d => isMemberBlackedOut(alt.id, d, blackouts))) return false;
            if (monthCount(alt.id, monthOf(w)) >= tier.maxPerMonth) return false;
            if (!tier.allowAdjacentAlt && neighbourIsAlt(w)) return false;
            return true;
          });
          return { alt, slot: sl, remaining: altTargetQuotas[sl.key] - currentQuotas[sl.key], eligibleCount: eligibleWeekends.length, eligibleWeekends };
        })
        .sort((a, b) => (a.eligibleCount - a.remaining) - (b.eligibleCount - b.remaining));

      if (unmet.length === 0) return true;
      const { alt, slot, eligibleWeekends } = unmet[0];
      if (eligibleWeekends.length === 0) return false;

      const ideals = idealCache[slot.key];
      const distToIdeal = (w) => ideals.length ? Math.min(...ideals.map(p => Math.abs(indexInHalf(w) - p))) : 0;
      const adjPenalty = (w) => (w.index > 0 && altIds.has(currentAssignments[w.index - 1]) ? 1 : 0) +
        (w.index < weekends.length - 1 && altIds.has(currentAssignments[w.index + 1]) ? 1 : 0);
      eligibleWeekends.sort((wA, wB) => {
        if (adjPenalty(wA) !== adjPenalty(wB)) return adjPenalty(wA) - adjPenalty(wB);
        const dA = Math.round(distToIdeal(wA)), dB = Math.round(distToIdeal(wB));
        if (dA !== dB) return dA - dB;
        return wA.index - wB.index;
      });

      for (const w of eligibleWeekends) {
        currentAssignments[w.index] = alt.id;
        currentQuotas[slot.key]++;
        if (solveAlternateWeekends(tier, currentAssignments, currentQuotas)) return true;
        delete currentAssignments[w.index];
        currentQuotas[slot.key]--;
      }
      return false;
    }

    for (const tier of SPREAD_TIERS) {
      searchSteps = 0;
      if (solveAlternateWeekends(tier, weekendAssignments, altQuotaConsumed)) break;
    }
  }

  // STAGE 2b: Target Cadence Pre-Pass for Non-Quota Members (Every 2nd / 3rd / 4th Weekend)
  const cadenceMembers = roster
    .filter(m => !getRoleConfig(unitConfig, m.role).quotaEnabled && getRoleConfig(unitConfig, m.role).canWorkWeekends && getMemberTargetCadence(m))
    .sort((a, b) => getMemberTargetCadence(a) - getMemberTargetCadence(b));

  cadenceMembers.forEach(mem => {
    const cad = getMemberTargetCadence(mem);
    let lastAssignedIdx = -cad;
    if (priorRecentWeekendWorkers.length > 0) {
      for (let p = 0; p < Math.min(cad, priorRecentWeekendWorkers.length); p++) {
        if (priorRecentWeekendWorkers[p] === mem.id) {
          lastAssignedIdx = -(p + 1);
          break;
        }
      }
    }
    weekends.forEach(w => {
      if (weekendAssignments[w.index] === mem.id) {
        lastAssignedIdx = w.index;
        return;
      }
      if (weekendAssignments[w.index]) return;
      if (w.index - lastAssignedIdx < cad) return;
      if (!isMemberActive(mem, w.friday) || !isMemberActive(mem, w.sunday)) return;
      if (violatesWeekendGap(w.index, mem.id, weekendAssignments)) return;
      const checkDates = [w.friday, w.saturday, w.sunday];
      if (attachFriMon && w.attachedMonday) checkDates.push(w.attachedMonday);
      if (isExtendedMonWeekend(w)) checkDates.push(w.monday);
      if (checkDates.some(d => isMemberBlackedOut(mem.id, d, blackouts))) return;
      weekendAssignments[w.index] = mem.id;
      lastAssignedIdx = w.index;
    });
  });

  // STAGE 3: Full-Time Weekend Allocation
  const weekendPool = roster.filter(m => !getRoleConfig(unitConfig, m.role).quotaEnabled && getRoleConfig(unitConfig, m.role).canWorkWeekends);
  const ftWeekendCounts = {};
  weekendPool.forEach(ft => { ftWeekendCounts[ft.id] = 0; });
  if (priorDays.length > 0) {
    const priorWeekends = identifyWeekends(priorDays[0], priorDays[priorDays.length - 1], holidays);
    priorWeekends.forEach(pw => {
      const wId = priorAssignments[pw.saturday] || priorAssignments[pw.friday];
      if (ftWeekendCounts[wId] !== undefined) ftWeekendCounts[wId]++;
    });
  }
  Object.values(weekendAssignments).forEach(mId => {
    if (ftWeekendCounts[mId] !== undefined) ftWeekendCounts[mId]++;
  });

  const holidayWeight = (h) => isPremiumHoliday(h, unitConfig) ? 1 : 0.5;
  const weekendHolidayWeight = (w) => {
    if (!balanceHolidays) return 0;
    const dates = new Set([w.friday, w.saturday, w.sunday]);
    if (attachFriMon && w.attachedMonday) dates.add(w.attachedMonday);
    if (attachFriMon && w.attachedFriday) dates.add(w.attachedFriday);
    return (holidays || []).filter(h => dates.has(h.date)).reduce((sum, h) => sum + holidayWeight(h), 0);
  };
  const ftHolidayLoad = {};
  weekendPool.forEach(ft => { ftHolidayLoad[ft.id] = 0; });
  if (priorDays.length > 0 && balanceHolidays) {
    (holidays || []).forEach(h => {
      if (h.date < cycle.startDate) {
        const wId = priorAssignments[h.date];
        if (ftHolidayLoad[wId] !== undefined) ftHolidayLoad[wId] += holidayWeight(h);
      }
    });
  }
  weekends.forEach(w => {
    const id = weekendAssignments[w.index];
    if (ftHolidayLoad[id] !== undefined) ftHolidayLoad[id] += weekendHolidayWeight(w);
  });

  let holidayCountTolerance = 1;
  const rankFTs = (w, list) => {
    const hw = weekendHolidayWeight(w);
    const activeSet = weekendPool.filter(f => isMemberActive(f, w.friday) && isMemberActive(f, w.sunday) && !getMemberTargetCadence(f));
    const fallbackSet = activeSet.length > 0 ? activeSet : weekendPool.filter(f => isMemberActive(f, w.friday) && isMemberActive(f, w.sunday));
    const minCount = fallbackSet.length ? Math.min(...fallbackSet.map(f => ftWeekendCounts[f.id])) : 0;
    return list.sort((a, b) => {
      const cadA = getMemberTargetCadence(a) ? 1 : 0;
      const cadB = getMemberTargetCadence(b) ? 1 : 0;
      if (cadA !== cadB) return cadA - cadB;
      if (hw > 0 && balanceHolidays) {
        const aOk = ftWeekendCounts[a.id] <= minCount + holidayCountTolerance ? 0 : 1;
        const bOk = ftWeekendCounts[b.id] <= minCount + holidayCountTolerance ? 0 : 1;
        if (aOk !== bOk) return aOk - bOk;
        if (ftHolidayLoad[a.id] !== ftHolidayLoad[b.id]) return ftHolidayLoad[a.id] - ftHolidayLoad[b.id];
      }
      return ftWeekendCounts[a.id] - ftWeekendCounts[b.id];
    });
  };
  const takeWeekend = (w, ft) => {
    weekendAssignments[w.index] = ft.id;
    ftWeekendCounts[ft.id]++;
    ftHolidayLoad[ft.id] += weekendHolidayWeight(w);
  };
  const releaseWeekend = (w, ft) => {
    delete weekendAssignments[w.index];
    ftWeekendCounts[ft.id]--;
    ftHolidayLoad[ft.id] -= weekendHolidayWeight(w);
  };
  const resetStage3 = () => {
    openWeekends.forEach(w => {
      const id = weekendAssignments[w.index];
      if (id && ftHolidayLoad[id] !== undefined) ftHolidayLoad[id] -= weekendHolidayWeight(w);
      delete weekendAssignments[w.index];
    });
    Object.keys(countsBeforeStage3).forEach(k => { ftWeekendCounts[k] = countsBeforeStage3[k]; });
  };

  const ftCandidatesFor = (w) => {
    return weekendPool.filter(ft => {
      if (!isMemberActive(ft, w.friday) || !isMemberActive(ft, w.sunday)) return false;
      if (violatesWeekendGap(w.index, ft.id)) return false;
      const checkDates = [w.friday, w.saturday, w.sunday];
      if (attachFriMon && w.attachedMonday) checkDates.push(w.attachedMonday);
      if (isExtendedMonWeekend(w)) checkDates.push(w.monday);
      return !checkDates.some(d => isMemberBlackedOut(ft.id, d, blackouts));
    });
  };

  const openWeekends = weekends.filter(w => !weekendAssignments[w.index]);
  const countsBeforeStage3 = { ...ftWeekendCounts };

  const fillOpenWeekends = () => {
    openWeekends.forEach(w => {
      const candidates = rankFTs(w, ftCandidatesFor(w));
      if (candidates.length > 0) takeWeekend(w, candidates[0]);
    });

    if (openWeekends.some(w => !weekendAssignments[w.index])) {
      resetStage3();
      let steps = 0;
      const MAX_STEPS = 200000;
      const dfs = (i) => {
        if (i === openWeekends.length) return true;
        if (++steps > MAX_STEPS) return false;
        const w = openWeekends[i];
        const cands = rankFTs(w, ftCandidatesFor(w));
        for (const ft of cands) {
          takeWeekend(w, ft);
          if (dfs(i + 1)) return true;
          releaseWeekend(w, ft);
        }
        return false;
      };
      if (!dfs(0)) {
        resetStage3();
        openWeekends.forEach(w => {
          const candidates = rankFTs(w, ftCandidatesFor(w));
          if (candidates.length > 0) takeWeekend(w, candidates[0]);
        });
      }
    }
  };

  const fullTenureFTs = weekendPool.filter(ft => isMemberActive(ft, cycle.startDate) && isMemberActive(ft, cycle.endDate) && !getMemberTargetCadence(ft));
  const weekendSpread = () => {
    if (fullTenureFTs.length < 2) return 0;
    const counts = fullTenureFTs.map(ft => ftWeekendCounts[ft.id]);
    return Math.max(...counts) - Math.min(...counts);
  };

  holidayCountTolerance = 1;
  fillOpenWeekends();
  if (weekendSpread() > 1) {
    resetStage3();
    holidayCountTolerance = 0;
    fillOpenWeekends();
  }

  openWeekends.forEach(w => {
    if (!weekendAssignments[w.index]) {
      diagnostics[w.friday] = `Stage 3 Deadlock: No eligible, non-consecutive member available for weekend of ${w.friday}.`;
    }
  });

  weekends.forEach(w => {
    const workerId = weekendAssignments[w.index];
    if (workerId) {
      if (!assignments[w.friday] && isSlotActiveOnDate(primarySlot, w.friday, holidays)) assignments[w.friday] = workerId;
      if (!assignments[w.saturday] && isSlotActiveOnDate(primarySlot, w.saturday, holidays)) assignments[w.saturday] = workerId;
      if (!assignments[w.sunday] && isSlotActiveOnDate(primarySlot, w.sunday, holidays)) assignments[w.sunday] = workerId;
    }
  });

  // STAGE 4: Attached Holiday (Fri/Mon) & Monday Shift Settlement
  const weekdayCounts = {};
  effectiveWeekdayPool.forEach(ft => { weekdayCounts[ft.id] = 0; });
  if (priorDays.length > 0) {
    Object.entries(priorAssignments).forEach(([d, id]) => {
      const dow = getDayOfWeek(d);
      if (dow >= 1 && dow <= 4 && weekdayCounts[id] !== undefined) weekdayCounts[id]++;
    });
  }
  Object.entries(assignments).forEach(([d, id]) => {
    const dow = getDayOfWeek(d);
    if (dow >= 1 && dow <= 4 && weekdayCounts[id] !== undefined) weekdayCounts[id]++;
  });

  weekends.forEach(w => {
    const workerId = weekendAssignments[w.index];
    const worker = roster.find(m => m.id === workerId);

    if (attachFriMon && w.attachedFriday && !assignments[w.attachedFriday] && isSlotActiveOnDate(primarySlot, w.attachedFriday, holidays)) {
      assignments[w.attachedFriday] = workerId;
    }

    if (attachFriMon && w.attachedMonday && !assignments[w.attachedMonday] && isSlotActiveOnDate(primarySlot, w.attachedMonday, holidays)) {
      assignments[w.attachedMonday] = workerId;
    }

    if (isExtendedMonWeekend(w) && !(attachFriMon && w.attachedMonday) && !assignments[w.monday] && isSlotActiveOnDate(primarySlot, w.monday, holidays)) {
      if (worker && !getRoleConfig(unitConfig, worker.role).quotaEnabled) {
        assignments[w.monday] = workerId;
      } else {
        const eligibleFTs = effectiveWeekdayPool.filter(ft => {
          if (!isMemberActive(ft, w.monday)) return false;
          if (isMemberBlackedOut(ft.id, w.monday, blackouts)) return false;
          return true;
        });
        eligibleFTs.sort((a, b) => (weekdayCounts[a.id] || 0) - (weekdayCounts[b.id] || 0));
        if (eligibleFTs.length > 0) {
          assignments[w.monday] = eligibleFTs[0].id;
          weekdayCounts[eligibleFTs[0].id] = (weekdayCounts[eligibleFTs[0].id] || 0) + 1;
        } else {
          diagnostics[w.monday] = `Stage 4 Warning: No member available for Monday ${w.monday}.`;
        }
      }
    }
  });

  // STAGE 5: Mid-Week Allocation
  const WEEKEND_WORKER_AVOID_THU_TUE_PENALTY = { 4: 2, 2: 1 };
  const WEEKEND_WORKER_WED_BONUS = 2;
  const weekendWorkerStartingOn = (fridayStr) => {
    const w = weekends.find(x => x.friday === fridayStr);
    return w ? weekendAssignments[w.index] : null;
  };
  const holidayLoadNow = (ftId, exceptDate) => {
    let sum = 0;
    if (priorDays.length > 0) {
      sum += (holidays || []).filter(h => h.date < cycle.startDate && priorAssignments[h.date] === ftId)
        .reduce((s, h) => s + holidayWeight(h), 0);
    }
    sum += (holidays || [])
      .filter(h => h.date >= cycle.startDate && h.date <= cycle.endDate && h.date !== exceptDate && assignments[h.date] === ftId)
      .reduce((s, h) => s + holidayWeight(h), 0);
    return sum;
  };
  const workedWeekdayThisWeek = (ftId, dateStr, dow) => {
    for (let k = 1; k < dow; k++) {
      const prevD = formatDate(addDays(dateStr, k - dow));
      if (assignments[prevD] === ftId) return true;
    }
    return false;
  };
  const ownsLaterBaselineThisWeek = (ft, dow, dateStr) => {
    if (weekdayMode !== 'custom_hybrid' && weekdayMode !== 'fixed_baseline') return false;
    if (!ft.baselineWeekday || ft.baselineWeekday <= dow || ft.baselineWeekday > 4) return false;
    const futureD = formatDate(addDays(dateStr, ft.baselineWeekday - dow));
    return isMemberActive(ft, futureD) && !isMemberBlackedOut(ft.id, futureD, blackouts);
  };
  const effectiveLoad = (ft, dow, dateStr, prevWorkerId = null, minEligibleCount = 0) => {
    const count = weekdayCounts[ft.id] || 0;
    let prefBonus = 0;
    if (weekdayMode === 'fire_marshal_phased_2027') {
      prefBonus = (ft.preferredWeekday === dow) ? 1 : 0;
    } else {
      const prefDow = ft.preferredWeekday || ft.baselineWeekday || null;
      if (prefDow === dow && count <= minEligibleCount) {
        prefBonus = 0.85;
      }
    }
    let load = count - prefBonus;
    if (weekdayMode !== 'fire_marshal_phased_2027') {
      if (prevWorkerId && ft.id === prevWorkerId && (dow === 1 || dow === 2)) {
        load += 50; // Last priority on Mon/Tue right after working a weekend
      }
      if (dateStr && workedWeekdayThisWeek(ft.id, dateStr, dow)) {
        load += 1.2;
      }
      if (dateStr && ownsLaterBaselineThisWeek(ft, dow, dateStr)) {
        load += 1.2;
      }
    }
    if (balanceHolidays && dateStr && (holidays || []).some(h => h.date === dateStr)) {
      load += 0.01 * holidayLoadNow(ft.id, dateStr);
    }
    if (rules.preWeekendShaping && dateStr && dow >= 2 && dow <= 4) {
      const upcomingFriday = formatDate(addDays(dateStr, 5 - dow));
      const worker = weekendWorkerStartingOn(upcomingFriday);
      if (worker === ft.id) {
        if (dow === 4) load += WEEKEND_WORKER_AVOID_THU_TUE_PENALTY[4];
        else if (dow === 2 && (weekdayMode !== 'fire_marshal_phased_2027' || upcomingFriday >= '2027-03-01')) load += WEEKEND_WORKER_AVOID_THU_TUE_PENALTY[2];
        else if (dow === 3 && (weekdayMode !== 'fire_marshal_phased_2027' || upcomingFriday >= '2027-03-01')) load -= WEEKEND_WORKER_WED_BONUS;
      }
    }
    return load;
  };

  const allDays = getAllDays(cycle.startDate, cycle.endDate);
  allDays.forEach(dateStr => {
    const dow = getDayOfWeek(dateStr);
    if (dow >= 1 && dow <= 4 && !assignments[dateStr] && isSlotActiveOnDate(primarySlot, dateStr, holidays)) {
      const daysSinceFriday = (dow + 2) % 7;
      const prevFri = formatDate(addDays(dateStr, -daysSinceFriday));
      const prevWeekend = weekends.find(w => w.friday === prevFri);
      let prevWorkerId = prevWeekend ? weekendAssignments[prevWeekend.index] : null;
      if (!prevWorkerId && prevFri === priorLastWeekendFriday) {
        prevWorkerId = priorLastWeekendWorker;
      }
      const prevWorker = prevWorkerId ? roster.find(m => m.id === prevWorkerId) : null;
      const restBlockedMemberId = (prevWorker && !getRoleConfig(unitConfig, prevWorker.role).quotaEnabled) ? prevWorker.id : null;
      const isDayRestBlocked = midweekBlockedSet.has(dow);

      const eligibleForDay = effectiveWeekdayPool.filter(ft => {
        if (!isMemberActive(ft, dateStr)) return false;
        if (isMemberBlackedOut(ft.id, dateStr, blackouts)) return false;
        if (isDayRestBlocked && ft.id === restBlockedMemberId) return false;
        return true;
      });
      const minEligibleCount = eligibleForDay.length ? Math.min(...eligibleForDay.map(f => weekdayCounts[f.id] || 0)) : 0;

      if (isPhase1Date(dateStr) || weekdayMode === 'custom_hybrid') {
        const baselineOwner = effectiveWeekdayPool.find(ft => ft.baselineWeekday === dow && isMemberActive(ft, dateStr));
        let candidateId = baselineOwner ? baselineOwner.id : undefined;

        const candidate = roster.find(m => m.id === candidateId);
        const isRestBlocked = isDayRestBlocked && candidateId === restBlockedMemberId;
        const isBlackedOut = isMemberBlackedOut(candidateId, dateStr, blackouts);
        const isActive = candidate && isMemberActive(candidate, dateStr);
        const isHybridOverloaded = weekdayMode === 'custom_hybrid' && candidate && (
          (weekdayCounts[candidate.id] || 0) > minEligibleCount ||
          (prevWorkerId === candidate.id && (dow === 1 || dow === 2)) ||
          workedWeekdayThisWeek(candidate.id, dateStr, dow)
        );

        const worksNextWeekend = rules.preWeekendShaping && dow === 4 && candidateId && weekendWorkerStartingOn(formatDate(addDays(dateStr, 1))) === candidateId;
        const swapAvailable = (worksNextWeekend || isHybridOverloaded) && eligibleForDay.some(ft => ft.id !== candidateId);

        if (!isRestBlocked && !isBlackedOut && isActive && !swapAvailable) {
          assignments[dateStr] = candidateId;
          weekdayCounts[candidateId] = (weekdayCounts[candidateId] || 0) + 1;
        } else {
          eligibleForDay.sort((a, b) => effectiveLoad(a, dow, dateStr, prevWorkerId, minEligibleCount) - effectiveLoad(b, dow, dateStr, prevWorkerId, minEligibleCount));

          if (eligibleForDay.length > 0) {
            assignments[dateStr] = eligibleForDay[0].id;
            weekdayCounts[eligibleForDay[0].id] = (weekdayCounts[eligibleForDay[0].id] || 0) + 1;
          } else {
            diagnostics[dateStr] = `Stage 5 Conflict: Zero eligible members available for ${dateStr} due to rest rule and blackouts.`;
          }
        }
      } else {
        eligibleForDay.sort((a, b) => effectiveLoad(a, dow, dateStr, prevWorkerId, minEligibleCount) - effectiveLoad(b, dow, dateStr, prevWorkerId, minEligibleCount));

        if (eligibleForDay.length > 0) {
          assignments[dateStr] = eligibleForDay[0].id;
          weekdayCounts[eligibleForDay[0].id] = (weekdayCounts[eligibleForDay[0].id] || 0) + 1;
        } else {
          diagnostics[dateStr] = `Stage 5 Conflict: Zero eligible members available for ${dateStr} due to rest rule and blackouts.`;
        }
      }
    }
  });

  Object.keys(assignments).forEach(d => {
    if ((d < cycle.startDate || d > cycle.endDate) && !(d in lockedShifts)) {
      delete assignments[d];
    }
  });

  return {
    assignments,
    diagnostics,
    preferenceWarnings,
    scheduleNotices,
    weekends
  };
}

/**
 * General Configurable Solver for AM/PM Multi-Slot, 7-Day Full-Week, and Daily Independent schedules.
 */
function solveConfigurableSchedule(cycle, roster, blackouts, holidays, manualOverrides, preferredWeekends, context, unitConfig) {
  const multiSlot = isMultiSlotConfig(unitConfig);
  const rules = unitConfig.rules;
  const holRules = unitConfig.holidayRules;
  const blockPattern = rules.blockPattern || 'fri_sun';
  const minGap = Math.max(0, parseInt(rules.minWeekendGap ?? 1, 10) || 0);
  const allowSamePersonAmPm = Boolean(rules.allowSamePersonAmPm);
  const restBlockedDows = new Set(getRestBlockedDows(unitConfig).midweekBlocked);
  const attachFriMon = holRules.attachFriMonHolidaysToWeekend !== false;
  const balanceHolidays = holRules.balanceHolidays !== false;

  const assignments = {};
  Object.entries(manualOverrides || {}).forEach(([d, val]) => {
    if (!val) return;
    if (typeof val === 'string') {
      const sid = getPrimarySlotId(unitConfig);
      setSlotMember(assignments, d, sid, val, unitConfig);
    } else if (typeof val === 'object') {
      Object.entries(val).forEach(([sid, mId]) => {
        if (typeof mId === 'string' && mId) {
          setSlotMember(assignments, d, sid, mId, unitConfig);
        }
      });
    }
  });

  const diagnostics = {};
  const preferenceWarnings = [];
  const scheduleNotices = [];
  const weekends = identifyWeekends(cycle.startDate, cycle.endDate, holidays);

  const totalShifts = {};
  const slotShifts = {};
  const blockCounts = {};
  const holLoad = {};
  roster.forEach(m => {
    totalShifts[m.id] = 0;
    slotShifts[m.id] = {};
    unitConfig.coverageSlots.forEach(s => { slotShifts[m.id][s.id] = 0; });
    blockCounts[m.id] = 0;
    holLoad[m.id] = 0;
  });

  const holidayWeight = (h) => isPremiumHoliday(h, unitConfig) ? 1 : 0.5;
  const countAssigned = (d, slotId, memberId) => {
    if (totalShifts[memberId] !== undefined) totalShifts[memberId]++;
    if (slotShifts[memberId] && slotShifts[memberId][slotId] !== undefined) slotShifts[memberId][slotId]++;
    if (balanceHolidays) {
      const h = (holidays || []).find(x => x.date === d);
      if (h && holLoad[memberId] !== undefined) holLoad[memberId] += holidayWeight(h);
    }
  };

  Object.keys(assignments).forEach(d => {
    unitConfig.coverageSlots.forEach(s => {
      const mId = getSlotMember(assignments, d, s.id, unitConfig);
      if (mId) countAssigned(d, s.id, mId);
    });
  });

  // Honor specific date requests first
  const preferredDates = Array.isArray(context.preferredDates) ? context.preferredDates : [];
  preferredDates.forEach(pd => {
    if (!pd || !pd.date || !pd.memberId) return;
    if (pd.date < cycle.startDate || pd.date > cycle.endDate) return;
    const targetSlotId = pd.slotId || getPrimarySlotId(unitConfig);
    const slot = unitConfig.coverageSlots.find(s => s.id === targetSlotId);
    if (!slot || !isSlotActiveOnDate(slot, pd.date, holidays)) return;
    if (getSlotMember(assignments, pd.date, targetSlotId, unitConfig)) return;
    const mem = roster.find(m => m.id === pd.memberId);
    if (!mem || !isMemberActive(mem, pd.date) || isMemberBlackedOut(mem.id, pd.date, blackouts)) {
      preferenceWarnings.push(`${mem ? mem.name : pd.memberId} - ${pd.date}: member inactive or blacked out.`);
      return;
    }
    if (multiSlot && !allowSamePersonAmPm) {
      const conflictOther = unitConfig.coverageSlots.some(s => s.id !== targetSlotId && getSlotMember(assignments, pd.date, s.id, unitConfig) === mem.id);
      if (conflictOther) {
        preferenceWarnings.push(`${mem.name} - ${pd.date}: already assigned to another shift on this date.`);
        return;
      }
    }
    setSlotMember(assignments, pd.date, targetSlotId, mem.id, unitConfig);
    countAssigned(pd.date, targetSlotId, mem.id);
  });

  const worksOtherSlotOnDay = (dateStr, slotId, memberId) => {
    if (!multiSlot || allowSamePersonAmPm) return false;
    return unitConfig.coverageSlots.some(s => s.id !== slotId && getSlotMember(assignments, dateStr, s.id, unitConfig) === memberId);
  };

  // MODE A: 7-Day Full-Week Block Rotation
  if (blockPattern === 'full_week') {
    const weeks = identifyWeeks(cycle.startDate, cycle.endDate, unitConfig.weekStartDay);
    const weekSlotWorker = {};

    weeks.forEach(wk => {
      unitConfig.coverageSlots.forEach(slot => {
        for (const d of wk.days) {
          if (d >= cycle.startDate && d <= cycle.endDate) {
            const mId = getSlotMember(assignments, d, slot.id, unitConfig);
            if (mId) {
              weekSlotWorker[`${wk.index}|${slot.id}`] = mId;
              break;
            }
          }
        }
      });
    });

    [...preferredWeekends].sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday)).forEach(p => {
      const mem = roster.find(m => m.id === p.memberId);
      if (!mem) return;
      const wk = weeks.find(w => w.days.includes(p.weekendFriday));
      if (!wk) return;
      const slot = unitConfig.coverageSlots[0];
      const key = `${wk.index}|${slot.id}`;
      if (weekSlotWorker[key]) return;
      const inRangeDays = wk.days.filter(d => d >= cycle.startDate && d <= cycle.endDate && isSlotActiveOnDate(slot, d, holidays));
      if (inRangeDays.some(d => !isMemberActive(mem, d) || isMemberBlackedOut(mem.id, d, blackouts))) {
        preferenceWarnings.push(`${mem.name} - week of ${wk.startDate}: blackout or inactive.`);
        return;
      }
      weekSlotWorker[key] = mem.id;
      blockCounts[mem.id] = (blockCounts[mem.id] || 0) + 1;
    });

    weeks.forEach(wk => {
      unitConfig.coverageSlots.forEach(slot => {
        const key = `${wk.index}|${slot.id}`;
        const activeDays = wk.days.filter(d => d >= cycle.startDate && d <= cycle.endDate && isSlotActiveOnDate(slot, d, holidays));
        if (activeDays.length === 0) return;

        let chosenId = weekSlotWorker[key];
        if (!chosenId) {
          const candidates = roster.filter(m => {
            const roleCfg = getRoleConfig(unitConfig, m.role);
            if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
            if (!roleCfg.canWorkWeekends && !roleCfg.canWorkWeekdays) return false;
            for (let g = 1; g <= minGap; g++) {
              if (wk.index - g >= 0 && weekSlotWorker[`${wk.index - g}|${slot.id}`] === m.id) return false;
            }
            if (activeDays.some(d => !isMemberActive(m, d) || isMemberBlackedOut(m.id, d, blackouts))) return false;
            if (activeDays.some(d => worksOtherSlotOnDay(d, slot.id, m.id))) return false;
            return true;
          });
          candidates.sort((a, b) => {
            const ba = blockCounts[a.id] || 0;
            const bb = blockCounts[b.id] || 0;
            if (ba !== bb) return ba - bb;
            return (totalShifts[a.id] || 0) - (totalShifts[b.id] || 0);
          });
          if (candidates.length > 0) {
            chosenId = candidates[0].id;
            weekSlotWorker[key] = chosenId;
            blockCounts[chosenId] = (blockCounts[chosenId] || 0) + 1;
          } else {
            diagnostics[activeDays[0]] = `No eligible member available for week of ${wk.startDate} (${slot.label}).`;
          }
        }

        if (chosenId) {
          activeDays.forEach(d => {
            if (!getSlotMember(assignments, d, slot.id, unitConfig)) {
              setSlotMember(assignments, d, slot.id, chosenId, unitConfig);
              countAssigned(d, slot.id, chosenId);
            }
          });
        }
      });
    });

    return { assignments, diagnostics, preferenceWarnings, scheduleNotices, weekends };
  }

  // MODE A2: Custom Multi-Day Block
  if (blockPattern === 'custom_block') {
    const customBlockSet = new Set(Array.isArray(rules.customBlockDows) && rules.customBlockDows.length ? rules.customBlockDows.map(Number) : [5, 6, 0]);
    const weeks = identifyWeeks(cycle.startDate, cycle.endDate, unitConfig.weekStartDay);
    const blockWorker = {};

    weeks.forEach(wk => {
      unitConfig.coverageSlots.forEach(slot => {
        const blockDays = wk.days.filter(d => {
          if (d < cycle.startDate || d > cycle.endDate) return false;
          return customBlockSet.has(getDayOfWeek(d)) && isSlotActiveOnDate(slot, d, holidays);
        });
        if (blockDays.length === 0) return;

        let chosenId = null;
        for (const d of blockDays) {
          const existing = getSlotMember(assignments, d, slot.id, unitConfig);
          if (existing) { chosenId = existing; break; }
        }
        if (!chosenId) {
          const candidates = roster.filter(m => {
            const roleCfg = getRoleConfig(unitConfig, m.role);
            if (!roleCfg.canWorkWeekends) return false;
            if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
            const gap = (m.minWeekendGap !== undefined && m.minWeekendGap !== null && m.minWeekendGap !== '') ? Math.max(0, parseInt(m.minWeekendGap, 10)) : minGap;
            for (let g = 1; g <= gap; g++) {
              if (wk.index - g >= 0 && blockWorker[`${wk.index - g}|${slot.id}`] === m.id) return false;
            }
            if (blockDays.some(d => !isMemberActive(m, d) || isMemberBlackedOut(m.id, d, blackouts))) return false;
            if (blockDays.some(d => worksOtherSlotOnDay(d, slot.id, m.id))) return false;
            return true;
          });
          candidates.sort((a, b) => (blockCounts[a.id] || 0) - (blockCounts[b.id] || 0) || (totalShifts[a.id] || 0) - (totalShifts[b.id] || 0));
          if (candidates.length > 0) {
            chosenId = candidates[0].id;
            blockCounts[chosenId] = (blockCounts[chosenId] || 0) + 1;
          }
        }
        if (chosenId) {
          blockWorker[`${wk.index}|${slot.id}`] = chosenId;
          blockDays.forEach(d => {
            if (!getSlotMember(assignments, d, slot.id, unitConfig)) {
              setSlotMember(assignments, d, slot.id, chosenId, unitConfig);
              countAssigned(d, slot.id, chosenId);
            }
          });
        }
      });
    });

    // Fall through to assign non-block days
    const allDays = getAllDays(cycle.startDate, cycle.endDate);
    allDays.forEach(dateStr => {
      const dow = getDayOfWeek(dateStr);
      const isHol = (holidays || []).some(h => h.date === dateStr);
      const activeSlots = getActiveSlotsForDate(dateStr, unitConfig, holidays);
      activeSlots.forEach(slot => {
        if (getSlotMember(assignments, dateStr, slot.id, unitConfig)) return;
        const candidates = roster.filter(m => {
          const roleCfg = getRoleConfig(unitConfig, m.role);
          if (!roleCfg.canWorkWeekdays && !isHol) return false;
          if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
          if (!isMemberActive(m, dateStr) || isMemberBlackedOut(m.id, dateStr, blackouts)) return false;
          if (worksOtherSlotOnDay(dateStr, slot.id, m.id)) return false;
          return true;
        });
        candidates.sort((a, b) => {
          const prefA = (a.baselineWeekday || a.preferredWeekday) === dow ? 1.5 : 0;
          const prefB = (b.baselineWeekday || b.preferredWeekday) === dow ? 1.5 : 0;
          return ((totalShifts[a.id] || 0) - prefA) - ((totalShifts[b.id] || 0) - prefB);
        });
        if (candidates.length > 0) {
          setSlotMember(assignments, dateStr, slot.id, candidates[0].id, unitConfig);
          countAssigned(dateStr, slot.id, candidates[0].id);
        }
      });
    });
    return { assignments, diagnostics, preferenceWarnings, scheduleNotices, weekends };
  }

  // MODE B: Multi-Slot Weekend+Weekday (e.g., AM/PM Split)
  if (blockPattern === 'fri_sun' || blockPattern === 'fri_mon_ft') {
    const weekendSlotWorker = {};

    const violatesSlotGap = (wIdx, slotId, memberId) => {
      const mem = roster.find(m => m.id === memberId);
      const gap = (mem && mem.minWeekendGap !== undefined && mem.minWeekendGap !== null && mem.minWeekendGap !== '')
        ? Math.max(0, parseInt(mem.minWeekendGap, 10))
        : minGap;
      for (let g = 1; g <= gap; g++) {
        if (wIdx - g >= 0 && weekendSlotWorker[`${wIdx - g}|${slotId}`] === memberId) return true;
        if (wIdx + g < weekends.length && weekendSlotWorker[`${wIdx + g}|${slotId}`] === memberId) return true;
      }
      return false;
    };

    [...preferredWeekends].sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday)).forEach(p => {
      const w = weekends.find(x => x.friday === p.weekendFriday);
      const mem = roster.find(m => m.id === p.memberId);
      if (!w || !mem) return;
      const targetSlot = unitConfig.coverageSlots.find(s => isSlotActiveOnDate(s, w.saturday, holidays)) || unitConfig.coverageSlots[0];
      const key = `${w.index}|${targetSlot.id}`;
      if (weekendSlotWorker[key]) return;
      const checkDates = [w.friday, w.saturday, w.sunday].filter(d => d >= cycle.startDate && d <= cycle.endDate && isSlotActiveOnDate(targetSlot, d, holidays));
      if (checkDates.some(d => !isMemberActive(mem, d) || isMemberBlackedOut(mem.id, d, blackouts))) {
        preferenceWarnings.push(`${mem.name} - weekend of ${w.friday}: blackout or inactive.`);
        return;
      }
      if (violatesSlotGap(w.index, targetSlot.id, mem.id)) {
        preferenceWarnings.push(`${mem.name} - weekend of ${w.friday}: consecutive weekend violation.`);
        return;
      }
      weekendSlotWorker[key] = mem.id;
      blockCounts[mem.id] = (blockCounts[mem.id] || 0) + 1;
    });

    weekends.forEach(w => {
      unitConfig.coverageSlots.forEach(slot => {
        const key = `${w.index}|${slot.id}`;
        const wkDays = [w.friday, w.saturday, w.sunday].filter(d => d >= cycle.startDate && d <= cycle.endDate && isSlotActiveOnDate(slot, d, holidays));
        if (attachFriMon && w.attachedFriday && w.attachedFriday >= cycle.startDate && isSlotActiveOnDate(slot, w.attachedFriday, holidays) && !wkDays.includes(w.attachedFriday)) {
          wkDays.unshift(w.attachedFriday);
        }
        if (attachFriMon && w.attachedMonday && w.attachedMonday <= cycle.endDate && isSlotActiveOnDate(slot, w.attachedMonday, holidays)) {
          wkDays.push(w.attachedMonday);
        }
        if (wkDays.length === 0) return;

        let chosenId = weekendSlotWorker[key] || getSlotMember(assignments, w.saturday, slot.id, unitConfig) || getSlotMember(assignments, w.sunday, slot.id, unitConfig);
        if (!chosenId) {
          const candidates = roster.filter(m => {
            const roleCfg = getRoleConfig(unitConfig, m.role);
            if (!roleCfg.canWorkWeekends) return false;
            if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
            if (violatesSlotGap(w.index, slot.id, m.id)) return false;
            if (wkDays.some(d => !isMemberActive(m, d) || isMemberBlackedOut(m.id, d, blackouts))) return false;
            if (wkDays.some(d => worksOtherSlotOnDay(d, slot.id, m.id))) return false;
            if (multiSlot && !allowSamePersonAmPm) {
              const otherSlotAlready = unitConfig.coverageSlots.some(s => s.id !== slot.id && weekendSlotWorker[`${w.index}|${s.id}`] === m.id);
              if (otherSlotAlready) return false;
            }
            return true;
          });
          candidates.sort((a, b) => {
            const ba = blockCounts[a.id] || 0;
            const bb = blockCounts[b.id] || 0;
            if (ba !== bb) return ba - bb;
            const sa = slotShifts[a.id]?.[slot.id] || 0;
            const sb = slotShifts[b.id]?.[slot.id] || 0;
            if (sa !== sb) return sa - sb;
            return (totalShifts[a.id] || 0) - (totalShifts[b.id] || 0);
          });
          if (candidates.length > 0) {
            chosenId = candidates[0].id;
            blockCounts[chosenId] = (blockCounts[chosenId] || 0) + 1;
          } else {
            diagnostics[w.saturday] = `No eligible member for weekend ${w.friday} (${slot.label}).`;
          }
        }
        if (chosenId) {
          weekendSlotWorker[key] = chosenId;
          wkDays.forEach(d => {
            if (!getSlotMember(assignments, d, slot.id, unitConfig)) {
              setSlotMember(assignments, d, slot.id, chosenId, unitConfig);
              countAssigned(d, slot.id, chosenId);
            }
          });
        }
      });
    });

    const allDays = getAllDays(cycle.startDate, cycle.endDate);
    allDays.forEach(dateStr => {
      const dow = getDayOfWeek(dateStr);
      const isRestDayDow = restBlockedDows.has(dow);
      let prevWeekendWorkers = new Set();
      if (dow >= 1 && dow <= 4) {
        const daysSinceFriday = (dow + 2) % 7;
        const prevFri = formatDate(addDays(dateStr, -daysSinceFriday));
        const prevW = weekends.find(w => w.friday === prevFri);
        if (prevW) {
          unitConfig.coverageSlots.forEach(s => {
            const wId = weekendSlotWorker[`${prevW.index}|${s.id}`] || getSlotMember(assignments, prevW.saturday, s.id, unitConfig);
            if (wId) prevWeekendWorkers.add(wId);
          });
        }
      }

      const activeSlots = getActiveSlotsForDate(dateStr, unitConfig, holidays);
      activeSlots.forEach(slot => {
        if (getSlotMember(assignments, dateStr, slot.id, unitConfig)) return;
        const isHol = (holidays || []).some(h => h.date === dateStr);
        const candidates = roster.filter(m => {
          const roleCfg = getRoleConfig(unitConfig, m.role);
          if (dow >= 1 && dow <= 5 && !isHol && !roleCfg.canWorkWeekdays) return false;
          if (isHol && !roleCfg.canWorkHolidays) return false;
          if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
          if (!isMemberActive(m, dateStr) || isMemberBlackedOut(m.id, dateStr, blackouts)) return false;
          if (isRestDayDow && prevWeekendWorkers.has(m.id)) return false;
          if (worksOtherSlotOnDay(dateStr, slot.id, m.id)) return false;
          return true;
        });

        const minTot = candidates.length ? Math.min(...candidates.map(c => totalShifts[c.id] || 0)) : 0;
        candidates.sort((a, b) => {
          const cntA = totalShifts[a.id] || 0;
          const cntB = totalShifts[b.id] || 0;
          const prefA = ((a.baselineWeekday || a.preferredWeekday) === dow && cntA <= minTot) ? 0.85 : 0;
          const prefB = ((b.baselineWeekday || b.preferredWeekday) === dow && cntB <= minTot) ? 0.85 : 0;
          const monTuePenA = (prevWeekendWorkers.has(a.id) && (dow === 1 || dow === 2)) ? 50 : 0;
          const monTuePenB = (prevWeekendWorkers.has(b.id) && (dow === 1 || dow === 2)) ? 50 : 0;
          const loadA = cntA - prefA + monTuePenA + (isHol && balanceHolidays ? 0.01 * (holLoad[a.id] || 0) : 0);
          const loadB = cntB - prefB + monTuePenB + (isHol && balanceHolidays ? 0.01 * (holLoad[b.id] || 0) : 0);
          if (loadA !== loadB) return loadA - loadB;
          return (slotShifts[a.id]?.[slot.id] || 0) - (slotShifts[b.id]?.[slot.id] || 0);
        });

        if (candidates.length > 0) {
          setSlotMember(assignments, dateStr, slot.id, candidates[0].id, unitConfig);
          countAssigned(dateStr, slot.id, candidates[0].id);
        } else {
          diagnostics[dateStr] = `No eligible member available for ${dateStr} (${slot.label}).`;
        }
      });
    });

    return { assignments, diagnostics, preferenceWarnings, scheduleNotices, weekends };
  }

  // MODE C: Daily Independent Shifts
  const allDays = getAllDays(cycle.startDate, cycle.endDate);
  allDays.forEach(dateStr => {
    const dow = getDayOfWeek(dateStr);
    const isWeekendDay = dow === 0 || dow === 6 || dow === 5;
    const isHol = (holidays || []).some(h => h.date === dateStr);
    const activeSlots = getActiveSlotsForDate(dateStr, unitConfig, holidays);

    activeSlots.forEach(slot => {
      if (getSlotMember(assignments, dateStr, slot.id, unitConfig)) return;
      const candidates = roster.filter(m => {
        const roleCfg = getRoleConfig(unitConfig, m.role);
        if (isWeekendDay && !roleCfg.canWorkWeekends) return false;
        if (!isWeekendDay && !isHol && !roleCfg.canWorkWeekdays) return false;
        if (isHol && !roleCfg.canWorkHolidays) return false;
        if (!memberAllowedForSlot(m, roleCfg, slot.id)) return false;
        if (!isMemberActive(m, dateStr) || isMemberBlackedOut(m.id, dateStr, blackouts)) return false;
        if (worksOtherSlotOnDay(dateStr, slot.id, m.id)) return false;
        return true;
      });

      candidates.sort((a, b) => {
        const prefA = (a.baselineWeekday || a.preferredWeekday) === dow ? 1.5 : 0;
        const prefB = (b.baselineWeekday || b.preferredWeekday) === dow ? 1.5 : 0;
        const loadA = (totalShifts[a.id] || 0) - prefA + (isHol && balanceHolidays ? 0.01 * (holLoad[a.id] || 0) : 0);
        const loadB = (totalShifts[b.id] || 0) - prefB + (isHol && balanceHolidays ? 0.01 * (holLoad[b.id] || 0) : 0);
        if (loadA !== loadB) return loadA - loadB;
        return (slotShifts[a.id]?.[slot.id] || 0) - (slotShifts[b.id]?.[slot.id] || 0);
      });

      if (candidates.length > 0) {
        setSlotMember(assignments, dateStr, slot.id, candidates[0].id, unitConfig);
        countAssigned(dateStr, slot.id, candidates[0].id);
      } else {
        diagnostics[dateStr] = `No eligible member available for ${dateStr} (${slot.label}).`;
      }
    });
  });

  return { assignments, diagnostics, preferenceWarnings, scheduleNotices, weekends };
}
