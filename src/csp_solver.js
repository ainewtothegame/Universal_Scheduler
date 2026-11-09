/**
 * csp_solver.js
 * 5-Stage Stratified Constraint Satisfaction Problem (CSP) Solver for PSP Fire Marshal On-Call Scheduling.
 */

import { formatDate, parseDate, addDays, getDayOfWeek, isPremiumHoliday } from './domain_data.js';

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
  if (dateStr < member.activeStart) return false;
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

  // Walk backwards if starting mid-weekend to find Friday, or walk forwards to first Friday
  // We want all Fridays that define weekends in this range
  const startDow = curr.getDay();
  if (startDow === 6) { // Saturday
    curr = addDays(curr, -1);
  } else if (startDow === 0) { // Sunday
    curr = addDays(curr, -2);
  } else if (startDow === 1) { // Monday
    const isAttMon = (holidays || []).some(h => h.date === startDateStr && h.type === 'attached_mon');
    if (isAttMon) curr = addDays(curr, -3);
  }

  while (curr <= end) {
    if (curr.getDay() === 5) { // Friday
      const fri = formatDate(curr);
      const sat = formatDate(addDays(curr, 1));
      const sun = formatDate(addDays(curr, 2));
      const mon = formatDate(addDays(curr, 3));
      const thu = formatDate(addDays(curr, -1));

      // Check attached holidays
      const friHoliday = holidays.find(h => h.date === fri && h.type === 'attached_fri');
      const monHoliday = holidays.find(h => h.date === mon && h.type === 'attached_mon');

      // Phase calculation: Phase 1 if before 2027-03-01, Phase 2 from 2027-03-01 onwards
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
        // All dates belonging to this weekend block
        dates: [fri, sat, sun]
      });
    }
    curr.setDate(curr.getDate() + 1);
  }

  return weekends;
}

/**
 * Master 5-Stage Stratified CSP Solver
 */
export function solveSchedule(cycle, roster, blackouts, holidays, manualOverrides = {}, preferredWeekends = [], context = {}) {
  // Only real member ids count as locked shifts; ignore legacy boolean flags (`true`) that older
  // versions of the UI stored here, which would otherwise be written into the schedule as a "member".
  const lockedShifts = {};
  Object.entries(manualOverrides || {}).forEach(([d, id]) => { if (typeof id === 'string' && id) lockedShifts[d] = id; });
  const assignments = { ...lockedShifts };
  const diagnostics = {};
  const preferenceWarnings = [];
  const scheduleNotices = []; // things the user should act on that are not skipped requests
  const activeFTs = roster.filter(m => m.role === 'FT');
  const activeALTs = roster.filter(m => m.role === 'ALT');

  // Prior period context (e.g. H1 when solving H2, or prior year H2/FULL when solving H1/FULL)
  const priorAssignments = context.priorAssignments || {};
  let priorLastWeekendWorker = null;
  let priorLastWeekendFriday = null;

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
    const perHalf = (a.weekendsPerSixMonths !== undefined && a.weekendsPerSixMonths !== null && !isNaN(Number(a.weekendsPerSixMonths)))
      ? Math.max(0, parseInt(a.weekendsPerSixMonths, 10))
      : 3;
    // Quotas are per 6-month half (so a FULL year gets perHalf in H1 AND in H2).
    halves.forEach(h => {
      altQuotaConsumed[`${a.id}|${h}`] = 0;
      altTargetQuotas[`${a.id}|${h}`] = perHalf;
    });
  });

  const weekendAssignments = {}; // weekend.index -> memberId

  const priorDays = Object.keys(priorAssignments).filter(d => d < cycle.startDate).sort();
  if (priorDays.length > 0) {
    const priorStartDate = priorDays[0];
    const priorEndDate = priorDays[priorDays.length - 1];
    const priorWeekends = identifyWeekends(priorStartDate, priorEndDate, holidays);
    if (priorWeekends.length > 0) {
      const lastPW = priorWeekends[priorWeekends.length - 1];
      // If lastPW matches weekends[0], check if weekends[0] was worked in priorAssignments
      if (weekends.length > 0 && lastPW.friday === weekends[0].friday) {
        const w0Worker = priorAssignments[lastPW.saturday] || priorAssignments[lastPW.friday] || priorAssignments[lastPW.sunday];
        if (w0Worker && !weekendAssignments[0]) {
          weekendAssignments[0] = w0Worker;
          const mem = roster.find(m => m.id === w0Worker);
          if (mem && mem.role === 'ALT') {
            altQuotaConsumed[`${w0Worker}|${halfOf(weekends[0])}`] = (altQuotaConsumed[`${w0Worker}|${halfOf(weekends[0])}`] || 0) + 1;
          }
        }
        if (priorWeekends.length > 1) {
          const penPW = priorWeekends[priorWeekends.length - 2];
          priorLastWeekendWorker = priorAssignments[penPW.saturday] || priorAssignments[penPW.friday] || priorAssignments[penPW.sunday];
          priorLastWeekendFriday = penPW.friday;
        }
      } else {
        priorLastWeekendWorker = priorAssignments[lastPW.saturday] || priorAssignments[lastPW.friday] || priorAssignments[lastPW.sunday];
        priorLastWeekendFriday = lastPW.friday;
      }
    }
  }

  // Pre-seed already manually locked weekends or weekends assigned in prior period
  weekends.forEach(w => {
    let assignedId = assignments[w.saturday] || assignments[w.friday] || assignments[w.sunday];
    if (!assignedId && priorAssignments) {
      assignedId = priorAssignments[w.saturday] || priorAssignments[w.friday] || priorAssignments[w.sunday];
    }
    if (assignedId) {
      weekendAssignments[w.index] = assignedId;
      const mem = roster.find(m => m.id === assignedId);
      if (mem && mem.role === 'ALT') {
        altQuotaConsumed[`${assignedId}|${halfOf(w)}`] = (altQuotaConsumed[`${assignedId}|${halfOf(w)}`] || 0) + 1;
      }
    }
  });

  // =========================================================================
  // STAGE 0: Lock Requested ("Want to Work") Weekends
  // =========================================================================
  // Requested weekends are hard constraints. Everything else is scheduled around them.
  // Order of precedence: (1) blackouts / tenure, (2) requested weekends, (3) everything else.
  // A requested weekend is ALWAYS honored, even beyond an Alternate's normal quota; it is skipped
  // (with a warning) only if it is physically impossible:
  // already locked manually, blackout/inactive, a second member requesting the same
  // weekend, or the same member requesting back-to-back weekends (rest rule).
  [...preferredWeekends]
    .sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday))
    .forEach(p => {
      const w = weekends.find(x => x.friday === p.weekendFriday);
      const mem = roster.find(m => m.id === p.memberId);
      if (!w || !mem) return; // outside this cycle or member removed

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
      if (w.attachedMonday) checkDates.push(w.attachedMonday);
      if (w.attachedFriday) checkDates.push(w.attachedFriday);
      if (mem.role === 'FT' && w.phase === 2) checkDates.push(w.monday);
      if (checkDates.some(d => isMemberBlackedOut(mem.id, d, blackouts))) {
        return skip('member has a blackout on those dates.');
      }
      if (weekendAssignments[w.index - 1] === mem.id || weekendAssignments[w.index + 1] === mem.id || (w.index === 0 && priorLastWeekendWorker === mem.id)) {
        return skip('would be back-to-back with another weekend for the same person (rest rule).');
      }

      weekendAssignments[w.index] = mem.id;
      if (mem.role === 'ALT') {
        altQuotaConsumed[`${mem.id}|${halfOf(w)}`] = (altQuotaConsumed[`${mem.id}|${halfOf(w)}`] || 0) + 1;
      }
    });

  // Pre-calculate all mandatory lookahead weekends in the cycle upfront
  const lookaheadWeekendFridays = new Set();
  const lookaheadMeta = new Map();
  weekends.forEach(wk => {
    if (wk.phase !== 2) return;
    const midWeekDays = [0, 1, 2, 3].map(n => formatDate(addDays(wk.monday, n)));
    const leaveFT = activeFTs.find(ft => {
      if (!isMemberActive(ft, wk.monday)) return false;
      return midWeekDays.filter(d => isMemberBlackedOut(ft.id, d, blackouts)).length >= 3;
    });
    if (leaveFT) {
      lookaheadWeekendFridays.add(wk.friday);
      lookaheadMeta.set(wk.friday, { ftMember: leaveFT, weekend: wk });
    }
  });

  // =========================================================================
  // STAGE 1: Mandatory Alternate Weekends Before FT Leave (Spec §7)
  // =========================================================================
  // When a full-time member is off for most of a Phase 2 week, only two FTs remain and the
  // post-weekend rest rule would leave one person covering Wed AND Thu (or worse). The spec
  // therefore REQUIRES an Alternate on the weekend before such a leave (e.g. May 7-9, Jun 25-27).
  // This runs AFTER requested weekends are locked: requests are never moved or dropped. If no
  // Alternate has quota left for such a weekend, it is reported in `scheduleNotices` so the user
  // can ask an Alternate whether they could give a different weekend instead.
  weekends.forEach(w => {
    if (w.phase !== 2 || weekendAssignments[w.index]) return;
    const meta = lookaheadMeta.get(w.friday);
    if (!meta) return;
    const ftOnLeave = meta.ftMember;
    const ftDisplayName = `${ftOnLeave.rank || 'Trooper'} ${ftOnLeave.firstName ? ftOnLeave.firstName + ' ' : ''}${ftOnLeave.name}`;

    const prevWeekendWorker = w.index > 0 ? weekendAssignments[w.index - 1] : null;
    const nextWeekendWorker = w.index < weekends.length - 1 ? weekendAssignments[w.index + 1] : null;
    const key = (alt) => `${alt.id}|${halfOf(w)}`;
    const candidates = activeALTs.filter(alt => {
      if (!isMemberActive(alt, w.friday)) return false;
      if (altQuotaConsumed[key(alt)] >= altTargetQuotas[key(alt)]) return false;
      if (prevWeekendWorker === alt.id || nextWeekendWorker === alt.id) return false;
      const checkDates = [w.friday, w.saturday, w.sunday];
      if (w.attachedMonday) checkDates.push(w.attachedMonday);
      return !checkDates.some(d => isMemberBlackedOut(alt.id, d, blackouts));
    });
    // Most remaining quota first, then roster order.
    candidates.sort((x, y) =>
      (altTargetQuotas[key(y)] - altQuotaConsumed[key(y)]) - (altTargetQuotas[key(x)] - altQuotaConsumed[key(x)]));

    const label = `${w.friday} to ${w.sunday}`;
    if (candidates.length > 0) {
      weekendAssignments[w.index] = candidates[0].id;
      altQuotaConsumed[key(candidates[0])] = (altQuotaConsumed[key(candidates[0])] || 0) + 1;
    } else {
      diagnostics[w.friday] = `Stage 1 Lookahead Warning: No rested Alternate available for lookahead weekend before ${ftOnLeave.name}'s leave.`;

      // In trial simulation mode, record notice and return early to avoid nested simulations
      if (context.isSimulation) {
        scheduleNotices.push(`Stage 1 lookahead unstaffed for ${w.friday}`);
        return;
      }

      const withRequests = [...new Set(preferredWeekends
        .filter(p => { const pw = weekends.find(x => x.friday === p.weekendFriday); return pw && halfOf(pw) === halfOf(w); })
        .map(p => roster.find(m => m.id === p.memberId))
        .filter(m => m && m.role === 'ALT')
        .map(m => m.name))];

      // Identify which Alternates are available for weekend w and simulate candidate switches
      const formatWkShort = (wk) => {
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const f = parseDate(wk.friday);
        const e = parseDate(wk.attachedMonday || wk.sunday);
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
        if (w.attachedMonday) checkDates.push(w.attachedMonday);
        if (w.attachedFriday) checkDates.push(w.attachedFriday);
        if (checkDates.some(d => isMemberBlackedOut(alt.id, d, blackouts))) return;
        if (prevWeekendWorker === alt.id || nextWeekendWorker === alt.id) return;

        const altRank = alt.rank || 'Trooper';
        const altDisplayName = `${altRank} ${alt.firstName ? alt.firstName + ' ' : ''}${alt.name}`;
        const altReqs = preferredWeekends
          .filter(p => p.memberId === alt.id)
          .map(p => weekends.find(x => x.friday === p.weekendFriday))
          .filter(pw => pw && halfOf(pw) === halfOf(w));

        if (altReqs.length === 0) {
          // Alternate has open quota (no requests in this half)
          const trialPrefs = [...preferredWeekends, { memberId: alt.id, weekendFriday: w.friday }];
          const trialRes = solveSchedule(cycle, roster, blackouts, holidays, lockedShifts, trialPrefs, { ...context, isSimulation: true });
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
          // If this requested weekend is itself protecting another FT's leave, protect it!
          if (lookaheadWeekendFridays.has(pw.friday)) {
            const lMeta = lookaheadMeta.get(pw.friday);
            const lFt = lMeta && lMeta.ftMember;
            const lFtDisplayName = lFt ? `${lFt.rank || 'Trooper'} ${lFt.firstName ? lFt.firstName + ' ' : ''}${lFt.name}` : 'full-time member';
            protectedWarnings.push(
              `${altDisplayName} requested ${formatWkShort(pw)}: protects schedule ahead of ${lFtDisplayName}'s leave. Switching away from ${formatWkShort(pw)} will create a new conflict.`
            );
            return;
          }

          // Run lookahead trial simulation replacing pw with w
          const trialPrefs = preferredWeekends.map(p => {
            if (p.memberId === alt.id && p.weekendFriday === pw.friday) {
              return { ...p, weekendFriday: w.friday };
            }
            return p;
          });

          const trialRes = solveSchedule(cycle, roster, blackouts, holidays, lockedShifts, trialPrefs, { ...context, isSimulation: true });
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
        `Weekend ${label} should be worked by an Alternate (${ftDisplayName} is off that following week, and the other two full-time members cannot cover it without long stretches), ` +
        `but no Alternate has an open weekend: their requested weekends already use their quota` +
        (withRequests.length ? ` (${withRequests.join(', ')} have requests in this period)` : '') +
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

  // =========================================================================
  // STAGE 2: Alternate Weekend Quota Allocation (CSP via MRV)
  // =========================================================================
  // Each Alternate gets their configured weekends per 6 months (default 3 per half, 6 for FULL)

  // Find remaining unassigned weekends
  const unassignedWeekends = weekends.filter(w => !weekendAssignments[w.index]);

  // One quota slot per (alternate, half-year)
  const slots = [];
  activeALTs.forEach(a => halves.forEach(h => slots.push({ alt: a, half: h, key: `${a.id}|${h}` })));

  // Alternates fill weekends that nobody requested, so spread them out: ideally an Alternate works
  // about once a month (here: a 3-per-half quota lands roughly every 2 months), never in two
  // consecutive weeks, and no two Alternates back-to-back. Requested weekends are already locked and
  // are never moved; these limits only shape the weekends the solver chooses itself.
  // The search is tried with the strictest limits first and relaxes only if nothing else fits:
  //   tier 1: max 1 weekend per Alternate per calendar month, no Alternate directly next to another
  //   tier 2: max 1 per month (neighbouring Alternates allowed)
  //   tier 3: max 2 per month
  //   tier 4: no monthly cap (previous behaviour)
  const SPREAD_TIERS = [
    { maxPerMonth: 1, allowAdjacentAlt: false },
    { maxPerMonth: 1, allowAdjacentAlt: true },
    { maxPerMonth: 2, allowAdjacentAlt: true },
    { maxPerMonth: Infinity, allowAdjacentAlt: true }
  ];
  const monthOf = (w) => w.friday.slice(0, 7);
  const altIds = new Set(activeALTs.map(a => a.id));
  const weekendsByHalf = {};
  weekends.forEach(w => { (weekendsByHalf[halfOf(w)] = weekendsByHalf[halfOf(w)] || []).push(w); });
  // "Ideal" evenly spaced positions for an Alternate's quota inside a half (staggered between Alternates)
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
    if (++searchSteps > MAX_SEARCH_STEPS) return false; // guard against pathological inputs
    const allQuotasMet = slots.every(sl => currentQuotas[sl.key] >= altTargetQuotas[sl.key]);
    if (allQuotasMet) return true;

    const monthCount = (altId, month) =>
      weekends.filter(x => currentAssignments[x.index] === altId && monthOf(x) === month).length;
    const neighbourIsAlt = (w) =>
      (w.index > 0 && altIds.has(currentAssignments[w.index - 1])) ||
      (w.index < weekends.length - 1 && altIds.has(currentAssignments[w.index + 1]));

    // Most constrained slot first (MRV): fewest legal weekends relative to the quota still needed
    const unmet = slots
      .filter(sl => currentQuotas[sl.key] < altTargetQuotas[sl.key])
      .map(sl => {
        const alt = sl.alt;
        const eligibleWeekends = unassignedWeekends.filter(w => {
          if (halfOf(w) !== sl.half) return false;
          if (currentAssignments[w.index]) return false;
          if (!isMemberActive(alt, w.friday)) return false;
          // Never two consecutive weekends for the same person
          if (w.index > 0 && currentAssignments[w.index - 1] === alt.id) return false;
          if (w.index === 0 && priorLastWeekendWorker === alt.id) return false;
          if (w.index < weekends.length - 1 && currentAssignments[w.index + 1] === alt.id) return false;
          const datesToCheck = [w.friday, w.saturday, w.sunday];
          if (w.attachedMonday) datesToCheck.push(w.attachedMonday);
          if (w.attachedFriday) datesToCheck.push(w.attachedFriday);
          if (datesToCheck.some(d => isMemberBlackedOut(alt.id, d, blackouts))) return false;
          // Spreading limits for this tier
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

    // Order candidate weekends: not next to another Alternate, then closest to this Alternate's
    // evenly spaced target positions, then earliest.
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

  // Try the strictest spreading limits first; relax only if the quotas cannot be placed.
  for (const tier of SPREAD_TIERS) {
    searchSteps = 0;
    if (solveAlternateWeekends(tier, weekendAssignments, altQuotaConsumed)) break;
  }

  // =========================================================================
  // STAGE 3: Full-Time Weekend Allocation
  // =========================================================================
  const ftWeekendCounts = {};
  activeFTs.forEach(ft => { ftWeekendCounts[ft.id] = 0; });
  // Include prior period weekend counts if available (e.g. H1 when solving H2)
  if (priorDays.length > 0) {
    const priorWeekends = identifyWeekends(priorDays[0], priorDays[priorDays.length - 1], holidays);
    priorWeekends.forEach(pw => {
      const wId = priorAssignments[pw.saturday] || priorAssignments[pw.friday];
      if (ftWeekendCounts[wId] !== undefined) ftWeekendCounts[wId]++;
    });
  }
  // Count already assigned weekends
  Object.values(weekendAssignments).forEach(mId => {
    if (ftWeekendCounts[mId] !== undefined) ftWeekendCounts[mId]++;
  });

  // ---- Holiday balance (the LAST consideration) -------------------------------------------------
  // Holidays should be shared as evenly as possible among the Full-Time members (Spec rule 5).
  // Premium holidays count 1, non-premium 0.5. It only reorders FT candidates that are already
  // legal and roughly equal on weekend count, so it never overrides blackouts, requests, the
  // spec's mandatory rules, rest/consecutive rules, or weekend/weekday equity.
  const holidayWeight = (h) => isPremiumHoliday(h) ? 1 : 0.5;
  const weekendHolidayWeight = (w) => {
    const dates = new Set([w.friday, w.saturday, w.sunday]);
    if (w.attachedMonday) dates.add(w.attachedMonday);
    if (w.attachedFriday) dates.add(w.attachedFriday);
    return holidays.filter(h => dates.has(h.date)).reduce((sum, h) => sum + holidayWeight(h), 0);
  };
  const ftHolidayLoad = {};
  activeFTs.forEach(ft => { ftHolidayLoad[ft.id] = 0; });
  // Include prior period holiday load if available
  if (priorDays.length > 0) {
    holidays.forEach(h => {
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
  let holidayCountTolerance = 1; // holiday balance may use anyone within this many weekends of the lowest
  // Order legal FT candidates: weekend equity first; on a holiday weekend, among those within the
  // tolerance, the one with the lightest holiday load goes first.
  const rankFTs = (w, list) => {
    const hw = weekendHolidayWeight(w);
    // Measured against every FT active that weekend (not just the legal candidates) so the
    // overall weekend spread among Full-Time members stays within the tolerance.
    const minCount = Math.min(...activeFTs.filter(f => isMemberActive(f, w.friday) && isMemberActive(f, w.sunday)).map(f => ftWeekendCounts[f.id]));
    return list.sort((a, b) => {
      if (hw > 0) {
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
    const prevWorker = w.index > 0 ? weekendAssignments[w.index - 1] : null;
    const nextWorker = w.index < weekends.length - 1 ? weekendAssignments[w.index + 1] : null;
    return activeFTs.filter(ft => {
      if (!isMemberActive(ft, w.friday) || !isMemberActive(ft, w.sunday)) return false;
      // Non-consecutive rule
      if (prevWorker === ft.id || nextWorker === ft.id) return false;
      if (w.index === 0 && priorLastWeekendWorker === ft.id) return false;
      // Blackout check (Fri, Sat, Sun, and attached Mon or Phase 2 Mon)
      const checkDates = [w.friday, w.saturday, w.sunday];
      if (w.attachedMonday) checkDates.push(w.attachedMonday);
      if (w.phase === 2) checkDates.push(w.monday);
      return !checkDates.some(d => isMemberBlackedOut(ft.id, d, blackouts));
    });
  };

  const openWeekends = weekends.filter(w => !weekendAssignments[w.index]);
  const countsBeforeStage3 = { ...ftWeekendCounts };

  // Fill all open weekends once (greedy first, bounded backtracking if greedy leaves a gap).
  const fillOpenWeekends = () => {
    // Pass 1: greedy fill, least-loaded eligible FT first (fast path; used whenever it succeeds).
    openWeekends.forEach(w => {
      const candidates = rankFTs(w, ftCandidatesFor(w));
      if (candidates.length > 0) takeWeekend(w, candidates[0]);
    });

    // Pass 2: if greedy left a weekend uncovered, retry with bounded backtracking
    // (same rules, same equity ordering) before reporting a deadlock.
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
        // Could not cover everything: fall back to the greedy partial result so the UI still shows a best effort.
        resetStage3();
        openWeekends.forEach(w => {
          const candidates = rankFTs(w, ftCandidatesFor(w));
          if (candidates.length > 0) takeWeekend(w, candidates[0]);
        });
      }
    }
  };

  // Weekend spread among the FTs who are active for the whole cycle (part-year members excluded).
  const fullTenureFTs = activeFTs.filter(ft => isMemberActive(ft, cycle.startDate) && isMemberActive(ft, cycle.endDate));
  const weekendSpread = () => {
    if (fullTenureFTs.length < 2) return 0;
    const counts = fullTenureFTs.map(ft => ftWeekendCounts[ft.id]);
    return Math.max(...counts) - Math.min(...counts);
  };

  // Holiday balance is the last consideration: try letting it use anyone within one weekend of the
  // lowest count, and keep that result only if the weekend counts stay within one of each other;
  // otherwise redo the fill with holiday balance limited to exact ties.
  holidayCountTolerance = 1;
  fillOpenWeekends();
  if (weekendSpread() > 1) {
    resetStage3();
    holidayCountTolerance = 0;
    fillOpenWeekends();
  }

  openWeekends.forEach(w => {
    if (!weekendAssignments[w.index]) {
      diagnostics[w.friday] = `Stage 3 Deadlock: No eligible, non-consecutive Full-Time member available for weekend of ${w.friday}.`;
    }
  });

  // Commit weekend assignments to daily assignments
  weekends.forEach(w => {
    const workerId = weekendAssignments[w.index];
    if (workerId) {
      if (!assignments[w.friday]) assignments[w.friday] = workerId;
      if (!assignments[w.saturday]) assignments[w.saturday] = workerId;
      if (!assignments[w.sunday]) assignments[w.sunday] = workerId;
    }
  });

  // =========================================================================
  // STAGE 4: Attached Holiday (Fri/Mon) & Monday Shift Settlement
  // =========================================================================
  const weekdayCounts = {};
  activeFTs.forEach(ft => { weekdayCounts[ft.id] = 0; });
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

    // Attached Friday Holiday (New Year's Day, Good Friday)
    if (w.attachedFriday && !assignments[w.attachedFriday]) {
      assignments[w.attachedFriday] = workerId;
    }

    // Attached Monday Holiday (MLK, Presidents', Memorial, Labor, Columbus, Jul 5)
    if (w.attachedMonday && !assignments[w.attachedMonday]) {
      assignments[w.attachedMonday] = workerId;
    }

    // Standard Monday in Phase 2
    if (w.phase === 2 && !w.attachedMonday && !assignments[w.monday]) {
      if (worker && worker.role === 'FT') {
        // FT Weekend Worker covers Monday (4-day shift)
        assignments[w.monday] = workerId;
      } else {
        // ALT worked weekend: Non-holiday Monday covered by active, rested FT member via round-robin
        const eligibleFTs = activeFTs.filter(ft => {
          if (!isMemberActive(ft, w.monday)) return false;
          if (isMemberBlackedOut(ft.id, w.monday, blackouts)) return false;
          return true;
        });
        eligibleFTs.sort((a, b) => (weekdayCounts[a.id] || 0) - (weekdayCounts[b.id] || 0));
        if (eligibleFTs.length > 0) {
          assignments[w.monday] = eligibleFTs[0].id;
          weekdayCounts[eligibleFTs[0].id] = (weekdayCounts[eligibleFTs[0].id] || 0) + 1;
        } else {
          diagnostics[w.monday] = `Stage 4 Warning: No FT member available for Monday ${w.monday}.`;
        }
      }
    }
  });

  // =========================================================================
  // STAGE 5: Mid-Week Allocation (Phase 1 Baseline vs. Phase 2 Dynamic Equity)
  // =========================================================================
  // Soft preference for the week leading into a full-timer's own Fri-Mon weekend (Phase 2):
  //   Tue = someone else, Wed = the weekend worker, Thu = someone else, Fri-Mon = the weekend worker.
  // e.g. Tue POLCHA, Wed WOLFE, Thu POLCHA, then WOLFE works Fri-Mon. This gives the weekend worker
  // a day off (Thu) before the weekend and avoids 5+ days in a row. These are tiebreaks that adjust
  // a member's effective weekday load; they never override blackouts, the Post-Weekend Rest Rule,
  // or Full-Time weekday equity (loads stay within a shift or two of each other).
  const WEEKEND_WORKER_AVOID_THU_TUE_PENALTY = { 4: 2, 2: 1 }; // Thursday strongest, then Tuesday
  const WEEKEND_WORKER_WED_BONUS = 2;
  const weekendWorkerStartingOn = (fridayStr) => {
    const w = weekends.find(x => x.friday === fridayStr);
    return w ? weekendAssignments[w.index] : null;
  };
  // Holiday balance for mid-week holidays (Election Day, Veterans Day, Thanksgiving): a tiny
  // tiebreak that can never outweigh a whole shift of weekday load.
  const holidayLoadNow = (ftId, exceptDate) => {
    let sum = 0;
    if (priorDays.length > 0) {
      sum += holidays.filter(h => h.date < cycle.startDate && priorAssignments[h.date] === ftId)
        .reduce((s, h) => s + holidayWeight(h), 0);
    }
    sum += holidays
      .filter(h => h.date >= cycle.startDate && h.date <= cycle.endDate && h.date !== exceptDate && assignments[h.date] === ftId)
      .reduce((s, h) => s + holidayWeight(h), 0);
    return sum;
  };
  const effectiveLoad = (ft, dow, dateStr) => {
    let load = (weekdayCounts[ft.id] || 0) - (ft.preferredWeekday === dow ? 1 : 0);
    if (dateStr && holidays.some(h => h.date === dateStr)) load += 0.01 * holidayLoadNow(ft.id, dateStr);
    if (dateStr && dow >= 2 && dow <= 4) {
      const upcomingFriday = formatDate(addDays(dateStr, 5 - dow));
      const worker = weekendWorkerStartingOn(upcomingFriday);
      if (worker === ft.id) {
        if (dow === 4) load += WEEKEND_WORKER_AVOID_THU_TUE_PENALTY[4];
        else if (dow === 2 && upcomingFriday >= '2027-03-01') load += WEEKEND_WORKER_AVOID_THU_TUE_PENALTY[2];
        else if (dow === 3 && upcomingFriday >= '2027-03-01') load -= WEEKEND_WORKER_WED_BONUS;
      }
    }
    return load;
  };

  // Collect all dates from start to end
  let walker = parseDate(cycle.startDate);
  const cycleEnd = parseDate(cycle.endDate);
  const allDays = [];
  while (walker <= cycleEnd) {
    allDays.push(formatDate(walker));
    walker.setDate(walker.getDate() + 1);
  }

  // Iterate by calendar week
  // A week's mid-week days are Monday (if unassigned), Tuesday, Wednesday, Thursday
  allDays.forEach(dateStr => {
    const dow = getDayOfWeek(dateStr); // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
    if (dow >= 1 && dow <= 4 && !assignments[dateStr]) {
      // Find the preceding weekend that ended before or on this week's start
      // Preceding weekend Friday date:
      const daysSinceFriday = (dow + 2) % 7; // Mon(1)->3 days, Tue(2)->4, Wed(3)->5, Thu(4)->6
      const prevFri = formatDate(addDays(dateStr, -daysSinceFriday));
      const prevWeekend = weekends.find(w => w.friday === prevFri);
      let prevWorkerId = prevWeekend ? weekendAssignments[prevWeekend.index] : null;
      if (!prevWorkerId && prevFri === priorLastWeekendFriday) {
        prevWorkerId = priorLastWeekendWorker;
      }
      const prevWorker = prevWorkerId ? roster.find(m => m.id === prevWorkerId) : null;

      const isPhase1 = dateStr < '2027-03-01';

      // Post-Weekend Rest Rule:
      // If an FT member worked the preceding weekend, they CANNOT work Wednesday (dow 3) or Thursday (dow 4)
      const restBlockedMemberId = (prevWorker && prevWorker.role === 'FT') ? prevWorker.id : null;

      if (isPhase1) {
        // Phase 1 Baseline allocation: Mon=Polcha, Tue=Kemerer, Wed=Wolfe, Thu=Terek
        const baselineOwner = activeFTs.find(ft => ft.baselineWeekday === dow && isMemberActive(ft, dateStr));
        let candidateId = baselineOwner ? baselineOwner.id : undefined;

        // Check feasibility of candidate
        const candidate = roster.find(m => m.id === candidateId);
        const isRestBlocked = (dow === 3 || dow === 4) && candidateId === restBlockedMemberId;
        const isBlackedOut = isMemberBlackedOut(candidateId, dateStr, blackouts);
        const isActive = candidate && isMemberActive(candidate, dateStr);

        const worksNextWeekend = dow === 4 && candidateId && weekendWorkerStartingOn(formatDate(addDays(dateStr, 1))) === candidateId;
        const swapAvailable = worksNextWeekend && activeFTs.some(ft =>
          ft.id !== candidateId && isMemberActive(ft, dateStr) && !isMemberBlackedOut(ft.id, dateStr, blackouts) && ft.id !== restBlockedMemberId);

        if (!isRestBlocked && !isBlackedOut && isActive && !swapAvailable) {
          assignments[dateStr] = candidateId;
          weekdayCounts[candidateId] = (weekdayCounts[candidateId] || 0) + 1;
        } else {
          // Swap with an eligible active rested FT member
          const eligibleSwaps = activeFTs.filter(ft => {
            if (!isMemberActive(ft, dateStr)) return false;
            if (isMemberBlackedOut(ft.id, dateStr, blackouts)) return false;
            if ((dow === 3 || dow === 4) && ft.id === restBlockedMemberId) return false;
            return true;
          });
          eligibleSwaps.sort((a, b) => effectiveLoad(a, dow, dateStr) - effectiveLoad(b, dow, dateStr));

          if (eligibleSwaps.length > 0) {
            assignments[dateStr] = eligibleSwaps[0].id;
            weekdayCounts[eligibleSwaps[0].id] = (weekdayCounts[eligibleSwaps[0].id] || 0) + 1;
          } else {
            diagnostics[dateStr] = `Stage 5 Conflict: Zero FT members available for ${dateStr} due to rest rule and blackouts.`;
          }
        }
      } else {
        // Phase 2 Dynamic Equity Allocation across Polcha, Terek, Wolfe
        const eligibleFTs = activeFTs.filter(ft => {
          if (!isMemberActive(ft, dateStr)) return false;
          if (isMemberBlackedOut(ft.id, dateStr, blackouts)) return false;
          // Post-weekend rest: FT who worked weekend cannot work Wed or Thu
          if ((dow === 3 || dow === 4) && ft.id === restBlockedMemberId) return false;
          return true;
        });

        // Dynamic balance: lowest weekday load wins; a member's 'preferred day if available'
        // counts as a one-shift head start so it only wins when it keeps loads within 1 of fair.
        eligibleFTs.sort((a, b) => effectiveLoad(a, dow, dateStr) - effectiveLoad(b, dow, dateStr));

        if (eligibleFTs.length > 0) {
          assignments[dateStr] = eligibleFTs[0].id;
          weekdayCounts[eligibleFTs[0].id] = (weekdayCounts[eligibleFTs[0].id] || 0) + 1;
        } else {
          diagnostics[dateStr] = `Stage 5 Conflict: Zero FT members available for ${dateStr} due to rest rule and blackouts.`;
        }
      }
    }
  });

  // Clamp: the last weekend of a cycle can spill into the next cycle/year
  // (e.g. a Dec 31 Friday). Drop auto-generated days outside the cycle range;
  // explicit manual overrides are kept untouched.
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
