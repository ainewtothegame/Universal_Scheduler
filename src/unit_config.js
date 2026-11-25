/**
 * unit_config.js
 * Configurable unit profile, coverage slots (single or AM/PM), PSP 80-hour biweekly
 * work/rest patterns, role permissions, and live rules summary generator.
 */

export const PSP_RANKS = ['Trooper', 'Corporal', 'Sergeant', 'Lieutenant'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const BLOCK_PATTERNS = {
  fri_sun: {
    id: 'fri_sun',
    label: 'Fri–Sun Weekend Block + Individual Weekdays',
    description: 'Friday, Saturday, and Sunday are assigned as a single weekend block; Monday–Thursday are assigned individually.'
  },
  fri_mon_ft: {
    id: 'fri_mon_ft',
    label: 'Fri–Mon Extended Weekend (FT) / Fri–Sun (ALT)',
    description: 'Full-Time members working a weekend also cover the following Monday (4-day block); Alternates cover Fri–Sun unless Monday is an attached holiday.'
  },
  full_week: {
    id: 'full_week',
    label: '7-Day Full-Week On-Call Block',
    description: 'One member covers an entire 7-day week aligned to the configured week start day.'
  },
  daily_independent: {
    id: 'daily_independent',
    label: 'Daily Independent Shifts',
    description: 'Every day (and each active shift slot) is scheduled independently without multi-day weekend locking.'
  }
};

export const REST_PATTERNS = {
  fire_marshal_thu_sun: {
    id: 'fire_marshal_thu_sun',
    label: 'PSP Fire Marshal (Mon–Wed 10-day stretch → Wed comp rest + Thu–Sun off)',
    midweekBlocked: [3, 4], // Wed, Thu
    allRestDows: [3, 4, 5, 6, 0], // Wed (comp), Thu–Sun off
    description: 'Members working a weekend work Mon–Wed (80 hrs) and are off Thu–Sun; Wednesday night on-call is also blocked.'
  },
  mon_tue_off: {
    id: 'mon_tue_off',
    label: 'Mon–Sun Stretch → Mon & Tue Off (Work Wed–Wed, Thu–Sun Off)',
    midweekBlocked: [1, 2], // Mon, Tue
    allRestDows: [1, 2],
    description: 'Members working a weekend/week are off Monday and Tuesday of the following week (80-hr pay period balance).'
  },
  tue_wed_off: {
    id: 'tue_wed_off',
    label: 'Mon–Sun Stretch → Tue & Wed Off (80-Hr Pay Period)',
    midweekBlocked: [2, 3], // Tue, Wed
    allRestDows: [2, 3],
    description: 'Members working a weekend/week take Tuesday and Wednesday off the following week.'
  },
  wed_wed_thu_sun: {
    id: 'wed_wed_thu_sun',
    label: 'Wed–Wed Stretch → Thu–Sun Off',
    midweekBlocked: [4], // Thu
    allRestDows: [4, 5, 6, 0],
    description: 'Members working a weekend are off Thursday through Sunday of the following week.'
  },
  custom: {
    id: 'custom',
    label: 'Custom Post-Weekend Blocked Days',
    midweekBlocked: [],
    allRestDows: [],
    description: 'Select specific weekdays after a weekend shift that are blocked for recovery.'
  },
  none: {
    id: 'none',
    label: 'None (No Mandatory Post-Weekend Rest Days)',
    midweekBlocked: [],
    allRestDows: [],
    description: 'No post-weekend recovery days are blocked.'
  }
};

export const WEEKDAY_MODES = {
  dynamic_equity: {
    id: 'dynamic_equity',
    label: 'Dynamic Equity Rotation (Balanced Shifts)',
    description: 'Distributes weekday shifts evenly across eligible members, honoring optional preferred weekdays when loads stay fair.'
  },
  fixed_baseline: {
    id: 'fixed_baseline',
    label: 'Fixed Baseline Weekdays (Swap on Conflict)',
    description: 'Assigns each member to their configured baseline weekday unless blocked by leave or rest rules.'
  },
  weekly_block: {
    id: 'weekly_block',
    label: 'Full-Week Block Assignment',
    description: 'Assigns all active days of a week to the same member.'
  },
  fire_marshal_phased_2027: {
    id: 'fire_marshal_phased_2027',
    label: 'Fire Marshal 2027 Phased (Fixed Jan–Feb, Dynamic Mar+)',
    description: 'Uses fixed baseline weekdays prior to 2027-03-01 and dynamic equity rotation from 2027-03-01 onward.'
  }
};

const DEFAULT_NON_PREMIUM_HOLIDAYS = ['Martin Luther King Day', "Presidents' Day", 'General Election Day'];

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function baseRoles(altWeekdayAllowed = false, altQuota = 3) {
  return [
    {
      id: 'FT',
      label: 'Full-Time',
      shortCode: 'FT',
      canWorkWeekdays: true,
      canWorkWeekends: true,
      canWorkHolidays: true,
      allowedSlotIds: null, // null = all slots
      quotaEnabled: false,
      defaultQuotaPerSixMonths: null
    },
    {
      id: 'ALT',
      label: 'Alternate',
      shortCode: 'ALT',
      canWorkWeekdays: altWeekdayAllowed,
      canWorkWeekends: true,
      canWorkHolidays: true,
      allowedSlotIds: null,
      quotaEnabled: true,
      defaultQuotaPerSixMonths: altQuota
    }
  ];
}

export const UNIT_PRESETS = {
  blank_psp: {
    presetId: 'blank_psp',
    presetName: 'Blank / Custom PSP Unit',
    agency: 'Pennsylvania State Police',
    unitName: 'PSP Specialty Unit',
    scheduleTitle: 'On-Call Schedule',
    memberLabel: 'Member',
    defaultRank: 'Trooper',
    weekStartDay: 1, // 1 = Monday, 0 = Sunday
    footerNote: 'On-call coverage begins at the configured shift start time.',
    coverageSlots: [
      {
        id: 'primary',
        label: 'On-Call',
        startTime: '17:00',
        endTime: '08:00',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        activeOnHolidays: true
      }
    ],
    rules: {
      blockPattern: 'fri_sun',
      restPattern: 'none',
      customRestDows: [],
      weekdayMode: 'dynamic_equity',
      minWeekendGap: 1,
      enforce80HourCap: true,
      payPeriodAnchorMonday: '2027-01-04',
      preWeekendShaping: false,
      proactiveAltLookahead: false,
      lookaheadLeaveThreshold: 3,
      allowSamePersonAmPm: false
    },
    roles: baseRoles(false, 3),
    holidayRules: {
      attachFriMonHolidaysToWeekend: true,
      balanceHolidays: true,
      nonPremiumHolidays: [...DEFAULT_NON_PREMIUM_HOLIDAYS]
    }
  },

  fire_marshal: {
    presetId: 'fire_marshal',
    presetName: 'PSP Fire Marshal (Troop H)',
    agency: 'Pennsylvania State Police',
    unitName: 'Troop H Fire Marshal Unit',
    scheduleTitle: 'Fire Marshal On-Call Scheduler',
    memberLabel: 'Investigator',
    defaultRank: 'Trooper',
    weekStartDay: 1,
    footerNote: 'On call starts PM that day (after scheduled shift) through 0600hrs the next morning.',
    coverageSlots: [
      {
        id: 'primary',
        label: 'On-Call',
        startTime: '17:00',
        endTime: '08:00',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        activeOnHolidays: true
      }
    ],
    rules: {
      blockPattern: 'fri_mon_ft',
      restPattern: 'fire_marshal_thu_sun',
      customRestDows: [3, 4],
      weekdayMode: 'fire_marshal_phased_2027',
      minWeekendGap: 1,
      enforce80HourCap: true,
      payPeriodAnchorMonday: '2027-01-04',
      preWeekendShaping: true,
      proactiveAltLookahead: true,
      lookaheadLeaveThreshold: 3,
      allowSamePersonAmPm: false
    },
    roles: baseRoles(false, 3),
    holidayRules: {
      attachFriMonHolidaysToWeekend: true,
      balanceHolidays: true,
      nonPremiumHolidays: [...DEFAULT_NON_PREMIUM_HOLIDAYS]
    }
  },

  am_pm_split: {
    presetId: 'am_pm_split',
    presetName: 'PSP AM / PM Split On-Call',
    agency: 'Pennsylvania State Police',
    unitName: 'PSP Specialty Unit (AM/PM)',
    scheduleTitle: 'AM / PM On-Call Schedule',
    memberLabel: 'Member',
    defaultRank: 'Trooper',
    weekStartDay: 1,
    footerNote: 'Mon–Fri PM coverage starts after regular shift; Sat–Sun and Holidays include AM and PM coverage.',
    coverageSlots: [
      {
        id: 'am',
        label: 'AM On-Call',
        startTime: '06:00',
        endTime: '18:00',
        activeDays: [0, 6], // Sat & Sun (+ Holidays)
        activeOnHolidays: true
      },
      {
        id: 'pm',
        label: 'PM On-Call',
        startTime: '18:00',
        endTime: '06:00',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        activeOnHolidays: true
      }
    ],
    rules: {
      blockPattern: 'fri_sun',
      restPattern: 'mon_tue_off',
      customRestDows: [1, 2],
      weekdayMode: 'dynamic_equity',
      minWeekendGap: 1,
      enforce80HourCap: true,
      payPeriodAnchorMonday: '2027-01-04',
      preWeekendShaping: false,
      proactiveAltLookahead: false,
      lookaheadLeaveThreshold: 3,
      allowSamePersonAmPm: false
    },
    roles: baseRoles(false, 3),
    holidayRules: {
      attachFriMonHolidaysToWeekend: true,
      balanceHolidays: true,
      nonPremiumHolidays: [...DEFAULT_NON_PREMIUM_HOLIDAYS]
    }
  },

  weekly_rotation: {
    presetId: 'weekly_rotation',
    presetName: 'PSP 7-Day Weekly Rotation',
    agency: 'Pennsylvania State Police',
    unitName: 'PSP Weekly Rotation Unit',
    scheduleTitle: 'Weekly On-Call Schedule',
    memberLabel: 'Member',
    defaultRank: 'Trooper',
    weekStartDay: 1,
    footerNote: 'Weekly on-call rotation runs Monday through Sunday with post-rotation recovery days off.',
    coverageSlots: [
      {
        id: 'primary',
        label: 'Weekly On-Call',
        startTime: '00:00',
        endTime: '24:00',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        activeOnHolidays: true
      }
    ],
    rules: {
      blockPattern: 'full_week',
      restPattern: 'mon_tue_off',
      customRestDows: [1, 2],
      weekdayMode: 'weekly_block',
      minWeekendGap: 1,
      enforce80HourCap: true,
      payPeriodAnchorMonday: '2027-01-04',
      preWeekendShaping: false,
      proactiveAltLookahead: false,
      lookaheadLeaveThreshold: 3,
      allowSamePersonAmPm: false
    },
    roles: baseRoles(true, 3),
    holidayRules: {
      attachFriMonHolidaysToWeekend: true,
      balanceHolidays: true,
      nonPremiumHolidays: [...DEFAULT_NON_PREMIUM_HOLIDAYS]
    }
  }
};

/**
 * Creates a deep-cloned unitConfig from a preset ID with optional overrides.
 */
export function createUnitConfig(presetId = 'blank_psp', overrides = {}) {
  const base = UNIT_PRESETS[presetId] || UNIT_PRESETS.blank_psp;
  const cfg = clone(base);
  if (overrides && typeof overrides === 'object') {
    if (overrides.rules) {
      cfg.rules = { ...cfg.rules, ...overrides.rules };
    }
    if (overrides.holidayRules) {
      cfg.holidayRules = { ...cfg.holidayRules, ...overrides.holidayRules };
    }
    Object.keys(overrides).forEach(k => {
      if (k !== 'rules' && k !== 'holidayRules') {
        cfg[k] = clone(overrides[k]);
      }
    });
  }
  return normalizeUnitConfig(cfg);
}

/**
 * Ensures any partial or older unitConfig has all required fields and valid defaults.
 */
export function normalizeUnitConfig(cfg) {
  const base = clone(UNIT_PRESETS.blank_psp);
  if (!cfg || typeof cfg !== 'object') return base;

  const merged = {
    ...base,
    ...cfg,
    rules: { ...base.rules, ...(cfg.rules || {}) },
    holidayRules: { ...base.holidayRules, ...(cfg.holidayRules || {}) }
  };

  if (!Array.isArray(merged.coverageSlots) || merged.coverageSlots.length === 0) {
    merged.coverageSlots = clone(base.coverageSlots);
  } else {
    merged.coverageSlots = merged.coverageSlots.map((s, idx) => ({
      id: String(s.id || (idx === 0 ? 'primary' : `slot_${idx + 1}`)),
      label: String(s.label || 'On-Call'),
      startTime: String(s.startTime || '17:00'),
      endTime: String(s.endTime || '08:00'),
      activeDays: Array.isArray(s.activeDays) && s.activeDays.length ? s.activeDays.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      activeOnHolidays: s.activeOnHolidays !== false
    }));
  }

  if (!Array.isArray(merged.roles) || merged.roles.length === 0) {
    merged.roles = clone(base.roles);
  } else {
    merged.roles = merged.roles.map(r => ({
      id: String(r.id || 'FT').toUpperCase(),
      label: String(r.label || r.id || 'Role'),
      shortCode: String(r.shortCode || r.id || 'FT').toUpperCase(),
      canWorkWeekdays: r.canWorkWeekdays !== false,
      canWorkWeekends: r.canWorkWeekends !== false,
      canWorkHolidays: r.canWorkHolidays !== false,
      allowedSlotIds: Array.isArray(r.allowedSlotIds) && r.allowedSlotIds.length ? r.allowedSlotIds : null,
      quotaEnabled: Boolean(r.quotaEnabled),
      defaultQuotaPerSixMonths: r.quotaEnabled
        ? (r.defaultQuotaPerSixMonths !== undefined && r.defaultQuotaPerSixMonths !== null ? Number(r.defaultQuotaPerSixMonths) : 3)
        : null
    }));
  }

  if (!Array.isArray(merged.holidayRules.nonPremiumHolidays)) {
    merged.holidayRules.nonPremiumHolidays = [...DEFAULT_NON_PREMIUM_HOLIDAYS];
  }
  merged.weekStartDay = merged.weekStartDay === 0 ? 0 : 1;
  merged.rules.minWeekendGap = Math.max(0, parseInt(merged.rules.minWeekendGap ?? 1, 10) || 0);
  merged.rules.lookaheadLeaveThreshold = Math.max(1, parseInt(merged.rules.lookaheadLeaveThreshold ?? 3, 10) || 3);
  if (!Array.isArray(merged.rules.customRestDows)) merged.rules.customRestDows = [];

  return merged;
}

export function isMultiSlotConfig(unitConfig) {
  return Boolean(unitConfig && Array.isArray(unitConfig.coverageSlots) && unitConfig.coverageSlots.length > 1);
}

export function getPrimarySlotId(unitConfig) {
  if (!unitConfig || !Array.isArray(unitConfig.coverageSlots) || unitConfig.coverageSlots.length === 0) {
    return 'primary';
  }
  return unitConfig.coverageSlots[0].id;
}

export function isSlotActiveOnDate(slot, dateStr, holidays = []) {
  if (!slot) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d, 0, 0, 0, 0).getDay();
  const isHol = Array.isArray(holidays) && holidays.some(h => h.date === dateStr);
  if (isHol && slot.activeOnHolidays) return true;
  return Array.isArray(slot.activeDays) ? slot.activeDays.includes(dow) : true;
}

export function getActiveSlotsForDate(dateStr, unitConfig, holidays = []) {
  const cfg = normalizeUnitConfig(unitConfig);
  return cfg.coverageSlots.filter(slot => isSlotActiveOnDate(slot, dateStr, holidays));
}

/**
 * Reads a memberId for (dateStr, slotId) regardless of whether assignments[dateStr]
 * is a legacy single-slot string or a v2 { [slotId]: memberId } object.
 */
export function getSlotMember(assignments, dateStr, slotId = null, unitConfig = null) {
  if (!assignments) return null;
  const val = assignments[dateStr];
  if (!val) return null;
  if (typeof val === 'string') {
    if (!slotId || !unitConfig || slotId === getPrimarySlotId(unitConfig) || !isMultiSlotConfig(unitConfig)) {
      return val;
    }
    return null;
  }
  if (typeof val === 'object') {
    const targetSlot = slotId || getPrimarySlotId(unitConfig);
    return val[targetSlot] || null;
  }
  return null;
}

/**
 * Sets or clears a memberId for (dateStr, slotId) using single-string storage for
 * single-slot configs and object map storage for multi-slot configs.
 */
export function setSlotMember(assignments, dateStr, slotId, memberId, unitConfig = null) {
  if (!assignments) return;
  const multi = isMultiSlotConfig(unitConfig);
  const targetSlot = slotId || getPrimarySlotId(unitConfig);

  if (!multi) {
    if (memberId) assignments[dateStr] = memberId;
    else delete assignments[dateStr];
    return;
  }

  let entry = assignments[dateStr];
  if (typeof entry === 'string') {
    entry = { [getPrimarySlotId(unitConfig)]: entry };
  } else if (!entry || typeof entry !== 'object') {
    entry = {};
  } else {
    entry = { ...entry };
  }

  if (memberId) {
    entry[targetSlot] = memberId;
  } else {
    delete entry[targetSlot];
  }

  if (Object.keys(entry).length === 0) {
    delete assignments[dateStr];
  } else {
    assignments[dateStr] = entry;
  }
}

/**
 * Returns all assigned { slotId, memberId } pairs on a given date.
 */
export function getDayAssignedEntries(assignments, dateStr, unitConfig = null) {
  if (!assignments) return [];
  const val = assignments[dateStr];
  if (!val) return [];
  if (typeof val === 'string') {
    return [{ slotId: getPrimarySlotId(unitConfig), memberId: val }];
  }
  if (typeof val === 'object') {
    const slots = unitConfig?.coverageSlots || [];
    const orderedIds = slots.map(s => s.id);
    return Object.entries(val)
      .filter(([, mId]) => Boolean(mId))
      .sort(([a], [b]) => {
        const ia = orderedIds.indexOf(a);
        const ib = orderedIds.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([slotId, memberId]) => ({ slotId, memberId }));
  }
  return [];
}

/**
 * Converts assignments between single-slot string format and multi-slot object format
 * when a unit changes its coverageSlots configuration.
 */
export function normalizeAssignmentsForConfig(assignments, unitConfig) {
  const out = {};
  if (!assignments || typeof assignments !== 'object') return out;
  const multi = isMultiSlotConfig(unitConfig);
  const primaryId = getPrimarySlotId(unitConfig);
  const validSlotIds = new Set((unitConfig?.coverageSlots || []).map(s => s.id));

  Object.entries(assignments).forEach(([dateStr, val]) => {
    if (!val) return;
    if (!multi) {
      if (typeof val === 'string') {
        out[dateStr] = val;
      } else if (typeof val === 'object') {
        const picked = val[primaryId] || Object.values(val).find(Boolean);
        if (picked) out[dateStr] = picked;
      }
    } else {
      if (typeof val === 'string') {
        const fallbackSlot = validSlotIds.has('pm') ? 'pm' : primaryId;
        out[dateStr] = { [fallbackSlot]: val };
      } else if (typeof val === 'object') {
        const cleaned = {};
        Object.entries(val).forEach(([sid, mId]) => {
          if (mId && (validSlotIds.size === 0 || validSlotIds.has(sid))) {
            cleaned[sid] = mId;
          }
        });
        if (Object.keys(cleaned).length > 0) out[dateStr] = cleaned;
      }
    }
  });
  return out;
}

/**
 * Returns post-weekend blocked days-of-week for a unit's restPattern.
 */
export function getRestBlockedDows(unitConfig) {
  const patternId = unitConfig?.rules?.restPattern || 'none';
  if (patternId === 'custom') {
    const dows = Array.isArray(unitConfig?.rules?.customRestDows)
      ? unitConfig.rules.customRestDows.map(Number)
      : [];
    return {
      midweekBlocked: dows.filter(d => d >= 1 && d <= 4),
      allRestDows: dows,
      label: dows.length ? `Custom (${dows.map(d => DAY_SHORT[d]).join(', ')})` : 'Custom (None)'
    };
  }
  const pat = REST_PATTERNS[patternId] || REST_PATTERNS.none;
  return {
    midweekBlocked: [...pat.midweekBlocked],
    allRestDows: [...pat.allRestDows],
    label: pat.label
  };
}

export function getRoleConfig(unitConfig, roleId) {
  const roles = unitConfig?.roles || [];
  const found = roles.find(r => r.id === roleId);
  if (found) return found;
  if (roleId === 'ALT') {
    return {
      id: 'ALT',
      label: 'Alternate',
      shortCode: 'ALT',
      canWorkWeekdays: false,
      canWorkWeekends: true,
      canWorkHolidays: true,
      allowedSlotIds: null,
      quotaEnabled: true,
      defaultQuotaPerSixMonths: 3
    };
  }
  return {
    id: roleId || 'FT',
    label: roleId || 'Full-Time',
    shortCode: roleId || 'FT',
    canWorkWeekdays: true,
    canWorkWeekends: true,
    canWorkHolidays: true,
    allowedSlotIds: null,
    quotaEnabled: false,
    defaultQuotaPerSixMonths: null
  };
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Generates a live, printable HTML summary of the unit's active scheduling rules.
 */
export function generateRulesSummaryHtml(unitConfig, holidays = []) {
  const cfg = normalizeUnitConfig(unitConfig);
  const rest = getRestBlockedDows(cfg);
  const blockInfo = BLOCK_PATTERNS[cfg.rules.blockPattern] || BLOCK_PATTERNS.fri_sun;
  const weekdayInfo = WEEKDAY_MODES[cfg.rules.weekdayMode] || WEEKDAY_MODES.dynamic_equity;

  const slotsRows = cfg.coverageSlots.map(s => `
    <tr>
      <td style="padding:7px 10px; border:1px solid var(--color-rule); font-weight:600;">${escapeHtml(s.label)}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${escapeHtml(s.startTime)} &ndash; ${escapeHtml(s.endTime)}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${s.activeDays.map(d => DAY_SHORT[d]).join(', ')}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${s.activeOnHolidays ? 'Yes' : 'No'}</td>
    </tr>
  `).join('');

  const rolesRows = cfg.roles.map(r => `
    <tr>
      <td style="padding:7px 10px; border:1px solid var(--color-rule); font-weight:600;">${escapeHtml(r.label)} (${escapeHtml(r.shortCode)})</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${r.canWorkWeekdays ? 'Yes' : 'No'}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${r.canWorkWeekends ? 'Yes' : 'No'}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${r.canWorkHolidays ? 'Yes' : 'No'}</td>
      <td style="padding:7px 10px; border:1px solid var(--color-rule);">${r.quotaEnabled ? `${r.defaultQuotaPerSixMonths ?? 3} weekends / 6 mo` : 'Equal-share'}</td>
    </tr>
  `).join('');

  const nonPrem = new Set(cfg.holidayRules.nonPremiumHolidays || []);
  const holList = (holidays || []).slice(0, 20).map(h =>
    `<li><strong>${escapeHtml(h.name)}</strong> (${escapeHtml(h.date)}) &mdash; ${nonPrem.has(h.name) ? 'Standard (0.5)' : 'Premium (1.0)'}${h.type && h.type.startsWith('attached') ? ', Attached to Weekend' : ''}</li>`
  ).join('');

  return `
    <div style="font-size:13px; line-height:1.6; color:var(--color-ink-2);">
      <h2 style="font-family:var(--font-display); font-size:20px; color:var(--color-ink); margin:0 0 4px 0;">${escapeHtml(cfg.agency)}: ${escapeHtml(cfg.unitName)}</h2>
      <p style="margin:0 0 14px 0; color:var(--text-muted);">Live Scheduling Rules, Coverage Slots, and PSP 80-Hour Constraints (${escapeHtml(cfg.presetName || 'Custom')})</p>

      <h3 style="font-size:15px; color:var(--color-accent); margin:14px 0 6px 0;">1. Daily Coverage Slots (${isMultiSlotConfig(cfg) ? 'AM / PM Split' : 'Single Shift'})</h3>
      <table class="matrix-table" style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <thead>
          <tr>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Slot</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Hours</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Active Days</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Active on Holidays</th>
          </tr>
        </thead>
        <tbody>${slotsRows}</tbody>
      </table>
      ${isMultiSlotConfig(cfg) ? `<p style="margin:4px 0 12px 0;"><strong>Same-Day AM + PM Assignment:</strong> ${cfg.rules.allowSamePersonAmPm ? 'Allowed' : 'Prohibited (different personnel required for AM and PM)'}</p>` : ''}

      <h3 style="font-size:15px; color:var(--color-accent); margin:14px 0 6px 0;">2. Work Block, Weekday &amp; PSP 80-Hour Rest Rules</h3>
      <ul style="margin:6px 0 12px 20px;">
        <li><strong>Calendar Week Starts:</strong> ${cfg.weekStartDay === 0 ? 'Sunday' : 'Monday'}</li>
        <li><strong>Block Structure:</strong> ${escapeHtml(blockInfo.label)}</li>
        <li><strong>Weekday Allocation:</strong> ${escapeHtml(weekdayInfo.label)}</li>
        <li><strong>Post-Weekend Rest / Days Off:</strong> ${escapeHtml(rest.label)}</li>
        <li><strong>80-Hour Biweekly Pay Period Cap:</strong> ${cfg.rules.enforce80HourCap ? `Enabled (anchored ${escapeHtml(cfg.rules.payPeriodAnchorMonday)})` : 'Disabled'}</li>
        <li><strong>Minimum Weekend Spacing:</strong> ${cfg.rules.minWeekendGap === 0 ? 'Back-to-back allowed' : `At least ${cfg.rules.minWeekendGap} week(s) between weekend blocks`}</li>
        <li><strong>Pre-Weekend Fatigue Shaping:</strong> ${cfg.rules.preWeekendShaping ? 'Enabled (avoids Thu before own weekend)' : 'Disabled'}</li>
        <li><strong>Proactive Alternate Lookahead:</strong> ${cfg.rules.proactiveAltLookahead ? `Enabled (${cfg.rules.lookaheadLeaveThreshold}+ midweek leave days)` : 'Disabled'}</li>
      </ul>

      <h3 style="font-size:15px; color:var(--color-accent); margin:14px 0 6px 0;">3. Personnel Roles &amp; Permissions</h3>
      <table class="matrix-table" style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <thead>
          <tr>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Role</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Weekdays</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Weekends</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Holidays</th>
            <th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); text-align:left;">Quota</th>
          </tr>
        </thead>
        <tbody>${rolesRows}</tbody>
      </table>

      <h3 style="font-size:15px; color:var(--color-accent); margin:14px 0 6px 0;">4. PSP Holidays (${holidays ? holidays.length : 0} configured for active year)</h3>
      <p style="margin:0 0 6px 0;">Attach Fri/Mon Holidays to Weekend Worker: <strong>${cfg.holidayRules.attachFriMonHolidaysToWeekend ? 'Yes' : 'No'}</strong> &bull; Fair Holiday Balancing: <strong>${cfg.holidayRules.balanceHolidays ? 'Yes' : 'No'}</strong></p>
      ${holList ? `<ul style="margin:6px 0 12px 20px; columns:2; column-gap:24px;">${holList}</ul>` : ''}

      <p style="margin-top:12px; padding:10px; background:var(--color-paper-2); border-radius:6px; border:1px solid var(--color-rule);">
        <strong>Schedule Footer Note:</strong> ${escapeHtml(cfg.footerNote)}
      </p>
    </div>
  `;
}
