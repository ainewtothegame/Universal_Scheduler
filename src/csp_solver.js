/**
 * csp_solver.js
 * 5-Stage Stratified Constraint Satisfaction Problem (CSP) Solver for PSP Fire Marshal On-Call Scheduling.
 */

import { formatDate, parseDate, addDays, getDayOfWeek } from './domain_data.js';

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
export function solveSchedule(cycle, roster, blackouts, holidays, manualOverrides = {}, preferredWeekends = []) {
  const assignments = { ...manualOverrides };
  const diagnostics = {};
  const preferenceWarnings = [];
  const activeFTs = roster.filter(m => m.role === 'FT');
  const activeALTs = roster.filter(m => m.role === 'ALT');

  const weekends = identifyWeekends(cycle.startDate, cycle.endDate, holidays);
  const altQuotaConsumed = {};
  activeALTs.forEach(a => { altQuotaConsumed[a.id] = 0; });

  const weekendAssignments = {}; // weekend.index -> memberId

  // Pre-seed already manually locked weekends
  weekends.forEach(w => {
    if (assignments[w.saturday]) {
      const assignedId = assignments[w.saturday];
      weekendAssignments[w.index] = assignedId;
      const mem = roster.find(m => m.id === assignedId);
      if (mem && mem.role === 'ALT') {
        altQuotaConsumed[assignedId] = (altQuotaConsumed[assignedId] || 0) + 1;
      }
    }
  });

  // =========================================================================
  // STAGE 0: Lock Requested ("Want to Work") Weekends
  // =========================================================================
  // Requested weekends are hard constraints. Everything else is scheduled around them.
  // A request is skipped (with a warning) only if it is physically impossible:
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
      if (weekendAssignments[w.index - 1] === mem.id || weekendAssignments[w.index + 1] === mem.id) {
        return skip('would be back-to-back with another weekend for the same person (rest rule).');
      }

      weekendAssignments[w.index] = mem.id;
      if (mem.role === 'ALT') {
        altQuotaConsumed[mem.id] = (altQuotaConsumed[mem.id] || 0) + 1;
      }
    });

  // =========================================================================
  // STAGE 1: Lock Manuals & Phase 2 Proactive Leave Lookaheads
  // =========================================================================
  // Detect any active FT member with leave covering >= 3 consecutive mid-week days or full week in Phase 2
  weekends.forEach(w => {
    // Only apply in Phase 2 (or if active FT count < 4)
    if (w.phase === 2 && !weekendAssignments[w.index]) {
      // The week following weekend w is week W. The weekdays are Mon w.monday through Thu
      const midWeekDays = [w.monday, formatDate(addDays(w.monday, 1)), formatDate(addDays(w.monday, 2)), formatDate(addDays(w.monday, 3))];
      
      // Check if any active FT has >= 3 blackout days in this mid-week window
      const ftOnLeave = activeFTs.find(ft => {
        if (!isMemberActive(ft, w.monday)) return false;
        const blackedDays = midWeekDays.filter(d => isMemberBlackedOut(ft.id, d, blackouts));
        return blackedDays.length >= 3;
      });

      if (ftOnLeave) {
        // Must place an eligible Alternate on weekend w (the weekend preceding ftOnLeave's vacation)
        // Find candidate Alternate
        const prevWeekendWorker = w.index > 0 ? weekendAssignments[w.index - 1] : null;
        const candidateAlt = activeALTs.find(alt => {
          if (!isMemberActive(alt, w.friday)) return false;
          // Check quota: max 3 per half-year block
          if (altQuotaConsumed[alt.id] >= 3) return false;
          // Check non-consecutive
          if (prevWeekendWorker === alt.id) return false;
          // Check blackouts for Fri, Sat, Sun, and attached Monday if applicable
          const checkDates = [w.friday, w.saturday, w.sunday];
          if (w.attachedMonday) checkDates.push(w.attachedMonday);
          const hasBlackout = checkDates.some(d => isMemberBlackedOut(alt.id, d, blackouts));
          return !hasBlackout;
        });

        if (candidateAlt) {
          weekendAssignments[w.index] = candidateAlt.id;
          altQuotaConsumed[candidateAlt.id] = (altQuotaConsumed[candidateAlt.id] || 0) + 1;
        } else {
          diagnostics[w.friday] = `Stage 1 Lookahead Warning: No rested Alternate available for lookahead weekend before ${ftOnLeave.name}'s leave.`;
        }
      }
    }
  });

  // =========================================================================
  // STAGE 2: Alternate Weekend Quota Allocation (CSP via MRV)
  // =========================================================================
  // Each Alternate gets exactly 3 weekends in H1 and 3 in H2 (quota = 3 per half)
  const targetQuota = cycle.blockType === 'FULL' ? 6 : 3;

  // Find remaining unassigned weekends
  const unassignedWeekends = weekends.filter(w => !weekendAssignments[w.index]);

  // Backtracking search to assign remaining Alternate quotas
  function solveAlternateWeekends(altIndex, currentAssignments, currentQuotas) {
    // Check if all alternates have met target quota
    const allQuotasMet = activeALTs.every(a => currentQuotas[a.id] >= targetQuota);
    if (allQuotasMet) return true;

    // Pick the most constrained Alternate using MRV (Minimum Remaining Values)
    // Most constrained = fewest available legal weekends relative to remaining quota needed
    const unmetAlts = activeALTs
      .filter(a => currentQuotas[a.id] < targetQuota)
      .map(alt => {
        const eligibleWeekends = unassignedWeekends.filter(w => {
          if (currentAssignments[w.index]) return false;
          if (!isMemberActive(alt, w.friday)) return false;
          // Non-consecutive check
          if (w.index > 0 && currentAssignments[w.index - 1] === alt.id) return false;
          if (w.index < weekends.length - 1 && currentAssignments[w.index + 1] === alt.id) return false;
          // Blackout check
          const datesToCheck = [w.friday, w.saturday, w.sunday];
          if (w.attachedMonday) datesToCheck.push(w.attachedMonday);
          if (w.attachedFriday) datesToCheck.push(w.attachedFriday);
          return !datesToCheck.some(d => isMemberBlackedOut(alt.id, d, blackouts));
        });
        return { alt, remaining: targetQuota - currentQuotas[alt.id], eligibleCount: eligibleWeekends.length, eligibleWeekends };
      })
      .sort((a, b) => (a.eligibleCount - a.remaining) - (b.eligibleCount - b.remaining));

    if (unmetAlts.length === 0) return true;
    const { alt, eligibleWeekends } = unmetAlts[0];

    // If an alternate has remaining quota but 0 eligible weekends, backtrack
    if (eligibleWeekends.length === 0) return false;

    // Prefer weekends spaced out across the 6 months (prefer weekends not immediately adjacent to another Alternate)
    eligibleWeekends.sort((wA, wB) => {
      const prevAIsAlt = wA.index > 0 && currentAssignments[wA.index - 1] && roster.find(m => m.id === currentAssignments[wA.index - 1])?.role === 'ALT';
      const nextAIsAlt = wA.index < weekends.length - 1 && currentAssignments[wA.index + 1] && roster.find(m => m.id === currentAssignments[wA.index + 1])?.role === 'ALT';
      const penaltyA = (prevAIsAlt ? 1 : 0) + (nextAIsAlt ? 1 : 0);

      const prevBIsAlt = wB.index > 0 && currentAssignments[wB.index - 1] && roster.find(m => m.id === currentAssignments[wB.index - 1])?.role === 'ALT';
      const nextBIsAlt = wB.index < weekends.length - 1 && currentAssignments[wB.index + 1] && roster.find(m => m.id === currentAssignments[wB.index + 1])?.role === 'ALT';
      const penaltyB = (prevBIsAlt ? 1 : 0) + (nextBIsAlt ? 1 : 0);

      if (penaltyA !== penaltyB) return penaltyA - penaltyB;
      return wA.index - wB.index;
    });

    for (const w of eligibleWeekends) {
      currentAssignments[w.index] = alt.id;
      currentQuotas[alt.id]++;

      if (solveAlternateWeekends(altIndex + 1, currentAssignments, currentQuotas)) {
        return true;
      }

      // Backtrack
      delete currentAssignments[w.index];
      currentQuotas[alt.id]--;
    }

    return false;
  }

  // Execute Stage 2 Alternate solver
  solveAlternateWeekends(0, weekendAssignments, altQuotaConsumed);

  // =========================================================================
  // STAGE 3: Full-Time Weekend Allocation
  // =========================================================================
  const ftWeekendCounts = {};
  activeFTs.forEach(ft => { ftWeekendCounts[ft.id] = 0; });
  // Count already assigned weekends
  Object.values(weekendAssignments).forEach(mId => {
    if (ftWeekendCounts[mId] !== undefined) ftWeekendCounts[mId]++;
  });

  weekends.forEach(w => {
    if (!weekendAssignments[w.index]) {
      // Find candidate active FT members
      const prevWorker = w.index > 0 ? weekendAssignments[w.index - 1] : null;
      const nextWorker = w.index < weekends.length - 1 ? weekendAssignments[w.index + 1] : null;

      const candidates = activeFTs.filter(ft => {
        if (!isMemberActive(ft, w.friday) || !isMemberActive(ft, w.sunday)) return false;
        // Non-consecutive rule
        if (prevWorker === ft.id || nextWorker === ft.id) return false;
        // Blackout check (Fri, Sat, Sun, and attached Mon or Phase 2 Mon)
        const checkDates = [w.friday, w.saturday, w.sunday];
        if (w.attachedMonday) checkDates.push(w.attachedMonday);
        if (w.phase === 2) checkDates.push(w.monday);
        const hasBlackout = checkDates.some(d => isMemberBlackedOut(ft.id, d, blackouts));
        return !hasBlackout;
      });

      // Sort candidates by lowest weekend count for equity
      candidates.sort((a, b) => ftWeekendCounts[a.id] - ftWeekendCounts[b.id]);

      if (candidates.length > 0) {
        const chosen = candidates[0];
        weekendAssignments[w.index] = chosen.id;
        ftWeekendCounts[chosen.id]++;
      } else {
        diagnostics[w.friday] = `Stage 3 Deadlock: No eligible, non-consecutive Full-Time member available for weekend of ${w.friday}.`;
      }
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
      const prevWorkerId = prevWeekend ? weekendAssignments[prevWeekend.index] : null;
      const prevWorker = prevWorkerId ? roster.find(m => m.id === prevWorkerId) : null;

      const isPhase1 = dateStr < '2027-03-01';

      // Post-Weekend Rest Rule:
      // If an FT member worked the preceding weekend, they CANNOT work Wednesday (dow 3) or Thursday (dow 4)
      const restBlockedMemberId = (prevWorker && prevWorker.role === 'FT') ? prevWorker.id : null;

      if (isPhase1) {
        // Phase 1 Baseline allocation: Mon=Polcha, Tue=Kemerer, Wed=Wolfe, Thu=Terek
        const baselineMap = { 1: 'polcha', 2: 'kemerer', 3: 'wolfe', 4: 'terek' };
        let candidateId = baselineMap[dow];

        // Check feasibility of candidate
        const candidate = roster.find(m => m.id === candidateId);
        const isRestBlocked = (dow === 3 || dow === 4) && candidateId === restBlockedMemberId;
        const isBlackedOut = isMemberBlackedOut(candidateId, dateStr, blackouts);
        const isActive = candidate && isMemberActive(candidate, dateStr);

        if (!isRestBlocked && !isBlackedOut && isActive) {
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
          eligibleSwaps.sort((a, b) => (weekdayCounts[a.id] || 0) - (weekdayCounts[b.id] || 0));

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

        // Dynamic balance: pick member with lowest weekday shift load
        eligibleFTs.sort((a, b) => (weekdayCounts[a.id] || 0) - (weekdayCounts[b.id] || 0));

        if (eligibleFTs.length > 0) {
          assignments[dateStr] = eligibleFTs[0].id;
          weekdayCounts[eligibleFTs[0].id] = (weekdayCounts[eligibleFTs[0].id] || 0) + 1;
        } else {
          diagnostics[dateStr] = `Stage 5 Conflict: Zero FT members available for ${dateStr} due to rest rule and blackouts.`;
        }
      }
    }
  });

  return {
    assignments,
    diagnostics,
    preferenceWarnings,
    weekends
  };
}
