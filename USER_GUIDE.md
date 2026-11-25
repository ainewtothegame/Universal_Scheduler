# PSP Universal Scheduler — User Guide

The **PSP Universal Scheduler** is a standalone, single-file (`index.html`) on-call scheduling application designed for Pennsylvania State Police (PSP) specialty units. Each unit runs its own independent schedule, roster, and ruleset directly in the browser with full JSON backup/restore.

---

## Quick-Start Workflow (Common Tasks)

1. **Unit Setup**: Open **Schedule Rules & Setup** and select your unit's preset (or configure AM/PM slots and 80-hour rest rules).
2. **Verify Roster**: Open **Roster** to add or verify your Troopers, Corporals, or Sergeants.
3. **Blackouts & Requests**: Add **Blackouts** (leave/training) and **Requests**, then click **Auto-Generate Schedule**.
4. **Review & Export**: Review the **Matrix** and **Breakdown** tabs, then **Print** or **Export Excel**.

## 1. Initial Unit Setup (`Schedule Rules & Setup`)

Click **Schedule Rules & Setup** in the top ribbon to configure your unit:

1. **Starter Presets**:
   - **Blank / Custom PSP Unit**: Clean slate with PSP official holidays and default settings.
   - **PSP Fire Marshal (Troop H Rules)**: Exact Troop H Fire Marshal ruleset (Fri–Mon FT weekends, Wed/Thu post-weekend rest, proactive Alternate lookahead).
   - **PSP AM / PM Split On-Call**: Two daily slots — `PM On-Call` (Mon–Sun after shift) and `AM On-Call` (Sat–Sun & Holidays) — with optional prohibition on the same member working both AM and PM.
   - **PSP 7-Day Weekly Rotation**: Full-week (Mon–Sun or Sun–Sat) on-call blocks with post-rotation days off.
2. **Unit Identity & Ranks**:
   - Set **Agency**, **Unit Name**, **Schedule Title**, **Member Label**, **Default Rank** (`Trooper`, `Corporal`, `Sergeant`, `Lieutenant`, or none), **Calendar Week Starts On** (Monday or Sunday), and **Footer Note**.
3. **Daily Coverage Slots (Single vs. AM / PM)**:
   - Choose **Single On-Call Shift** or **AM / PM Split On-Call**.
   - Configure each slot's **Label**, **Start Time**, **End Time**, **Active Days** (`Mon`–`Sun`), and whether it activates on **Holidays**.
4. **PSP 80-Hour Biweekly Pay Period & Rest Patterns**:
   - Choose your **Weekend / Block Pattern** (`Fri–Sun`, `Fri–Mon FT`, `7-Day Full-Week`, or `Daily Independent`).
   - Select your **Post-Weekend Rest / Days Off Pattern** (`Mon & Tue Off`, `Tue & Wed Off`, `Thu–Sun Off`, `Fire Marshal Wed/Thu`, `Custom`, or `None`).
   - Enable **80-Hour Biweekly Pay Period Alert** and set your **Anchor Monday** to flag if a member is scheduled on multiple weekends in the same 14-day pay period.
5. **Roles & PSP Holidays**:
   - Customize role permissions (Weekdays, Weekends, Holidays, optional 6-month weekend quotas).
   - Manage the **13 Official PSP Holidays** (toggle Premium 1.0 vs. Standard 0.5 weight, add custom dates, or reset to official PSP holidays).
6. **Active Rules Summary**:
   - Switch to the **Active Rules Summary** tab at any time to view or print your unit's live rules.

---

## 2. Managing Personnel (`Roster`)

- Click **Roster** to add members with **Rank** (`Trooper`, `Corporal`, `Sergeant`, `Lieutenant`, or custom), **First Name**, **Last Name**, **Role**, **Active Start/End Dates**, and **Badge Color**.
- Optional **Baseline Preferred Weekday** or **Preferred Day If Available** lets members express weekday preferences without breaking fairness.

---

## 3. Blackouts, Requests & Auto-Generate

- **Blackouts**: Enter approved leave or training ranges. The solver treats blackouts as hard constraints.
- **Requests**: Lock in **Requested Weekends** or **Specific Date / Shift Slot** requests before generating.
- **Auto-Generate Schedule**: Builds a conflict-free, balanced schedule respecting your unit's slots, roles, PSP 80-hour rest rules, and holidays.

---

## 4. Manually Assigning or Adjusting Shifts, Clearing, Views & Exports

- **Manually Assigning or Adjusting Shifts**: Click any calendar cell (or specific **AM / PM** badge) to reassign or clear a shift. Live rule checks warn before saving any rest, blackout, or same-day AM/PM conflicts.
- **Clearing Shifts (Current Month vs Entire Cycle)**: Click **Clear Calendar** to wipe either the active month or the entire schedule block.
- **Multi-Period & Full-Year Scheduling**: Use the **Cycle** dropdown or **+ Add Year / Block** to manage H1, H2, and Full-Year blocks; generating H2 automatically balances against H1.
- **Printing and Exporting**: Use **Print**, **Print All**, or **Export Excel** to output single months, full cycles, or `.xlsx` workbooks.
- **Matrix & Breakdown Views**: Inspect weekend/slot coverage and role-by-role fairness totals.
- **What the Dots on the Calendar Mean**:
  - **Red Dot**: Hard rule conflict (approved blackout, post-weekend rest violation, tenure boundary, or same-day AM/PM double-booking).
  - **Amber Dot**: Warning (consecutive weekend, 80-hour biweekly pay period alert, quota exceeded, or unassigned shift).
  - **Blue Dot**: Attention notice (multi-shift midweek coverage).
- **Matrix & Breakdown Views**: Inspect weekend/slot coverage and role-by-role fairness totals.
- **Print / Print All / Export Excel**: Print single months or the full cycle, or export to `.xlsx`.

---

## 5. Backups & Reusable Config Templates

- **Backup / Restore (Top Ribbon)**: Saves or restores **everything** (unit configuration, roster, blackouts, requests, and all schedules). Legacy `Work_Calendar` v1 backups are automatically migrated on restore.
- **Export Config / Import Config (Inside Schedule Rules & Setup)**: Saves or loads **only your unit's rules, slots, roles, and branding** as a reusable `.json` template without touching your roster or schedules.
