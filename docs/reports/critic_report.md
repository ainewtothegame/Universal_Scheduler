# Stage 7: Critic Review Report

* **Target File:** `docs/designs/fire_marshal_scheduler.md` (Lines 1–322)
* **Date:** 2026-11-05
* **Reviewers:** `egm-design`, `egm-structural`, `egm-style`
* **Standards Applied:** `feature-spec-standard`
* **Mode:** `CRITIC_REVIEW`

---

## Executive Summary

The Technical Design Document demonstrates exceptional alignment with offline architectural mandates, browser-native persistence, and operational barracks spreadsheet workflows. The 5-stage Stratified CSP Solver formulation provides an effective domain heuristic for navigating the combinatorial complexities of Pennsylvania State Police on-call scheduling.

This Critic Review identified **1 Blocker**, **7 Major discrepancies**, and **6 Nits** within the Feature Specification range (lines 1–322). The primary blocker stems from a contradiction between Solver Stage 4 and Stage 5 regarding Phase 2 Monday shift allocations and static baseline weekday seeding, which violates contractual Phase 2 weekend definitions and equitable rotation.

---

## Prioritized Findings

### Finding 1: Stage 5 Mid-Week Seeding Contradicts Phase 2 Monday Settlement & Rotation (🔴 Blocker)
* **Affected Scope:** Lines 208–229 (Section 3, Stages 4 & 5)
* **Discrepancy Description:** 
  Stage 5 Step 1 directs the solver to *"Seed Tuesday–Thursday with baseline preferences: Tue=Kemerer/Terek, Wed=Wolfe, Thu=Terek, Mon=Polcha."*
  1. In Phase 2, an FT weekend covers Fri–Mon (4 days). Stage 4 already settles attached holiday Mondays and non-holiday Mondays on Alternate weekends. Re-seeding `Mon=Polcha` in Stage 5 overwrites Stage 4 and breaches the 4-day FT weekend shift boundary.
  2. Statically seeding `Tue=Terek, Thu=Terek` in Phase 2 permanently assigns Terek to 2 out of 3 mid-week shifts, violating the requirement that Tuesday, Wednesday, and Thursday rotate evenly across Polcha, Terek, and Wolfe.
* **Recommendation:** Stage 5 must operate strictly on unassigned mid-week slots (Tue–Thu in Phase 2; Tue–Thu plus unassigned non-holiday Mon in Phase 1). In Phase 2, replace static seeding with a dynamic equity round-robin across rested FT members.

### Finding 2: Omission of Attached Friday Holidays from Solver Pipeline (🟡 Major)
* **Affected Scope:** Lines 208–215 (Section 3, Stage 4)
* **Discrepancy Description:** Stage 4 is titled *"Attached Holiday & Monday Shift Settlement"* and exclusively codifies rules for Attached Mondays, omitting official Attached Friday holidays: New Year's Day (Fri Jan 1) and Good Friday (Fri Mar 26).
* **Recommendation:** Rename Stage 4 to *"Attached Holiday (Fri/Mon) & Monday Shift Settlement"*. Explicitly specify that Attached Fridays are bound directly to the assigned weekend worker (FT or ALT) during Stage 3 / Stage 4.

### Finding 3: Open Question OQ-1 Already Specified in Baseline Specification (🟡 Major)
* **Affected Scope:** Lines 39–41 (Section: Open Questions, OQ-1)
* **Discrepancy Description:** OQ-1 asks whether mid-week holidays (Election Day, Veterans Day, Thanksgiving) require special weighting. `scheduling_spec_2027.md` Section 5 already specifies these are standard Tuesday/Thursday shifts covered by Full-Time members.
* **Recommendation:** Close OQ-1 and confirm in Section 2 that mid-week holidays are covered as standard weekday assignments.

### Finding 4: `RosterMember` Schema Incompatible with Alternates & Dynamic Rotation (🟡 Major)
* **Affected Scope:** Lines 126–136 (Section 2, Database Schema)
* **Discrepancy Description:** In `RosterMember`, `baselineWeekday: number;` is non-nullable. Alternates (`role: 'ALT'`) are strictly prohibited from regular weekdays and have no baseline weekday.
* **Recommendation:** Change to `baselineWeekday?: number | null;`.

### Finding 5: Incomplete Stage 1 Lookahead Detection Trigger (🟡 Major)
* **Affected Scope:** Lines 184–190 (Section 3, Stage 1)
* **Discrepancy Description:** Stage 1 triggers proactive Alternate placement strictly upon detecting *"any FT member with full-week leave (Mon–Fri)"*. In Phase 2, if an FT member takes 3 mid-week days off (e.g. Tue–Thu), the exact same bottleneck occurs.
* **Recommendation:** Broaden trigger to *"any FT member with leave covering 3 or more consecutive mid-week days (Mon–Thu) or full week"*.

### Finding 6: Missing Contractual Rules in `ConflictEngine` (🟡 Major)
* **Affected Scope:** Lines 255–262 (Section 5)
* **Discrepancy Description:** `ConflictEngine` omits checks for: (1) Alternate assigned to regular weekday, (2) Alternate exceeding 3 weekends in H1/H2, (3) Member assigned outside active tenure window (e.g., Kemerer after Feb 28).
* **Recommendation:** Add explicit red conflict indicators for Alternate weekday assignments, Alternate quota breaches, and tenure bounds.

### Finding 7: SheetJS Date Parsing & Leading Column Offset (🟡 Major)
* **Affected Scope:** Lines 247–254 (Section 4.B)
* **Discrepancy Description:** By default, SheetJS returns date codes as numeric floats unless `cellDates: true` is configured. Also, `calendar_2027_reference.csv` contains a leading empty column A (`col 0`).
* **Recommendation:** Specify `cellDates: true` and dynamic column alignment relative to the detected `MONDAY` token.

### Finding 8: `ScheduleCycle` Omits Blackout Snapshot and Solver Diagnostics (🟡 Major)
* **Affected Scope:** Lines 156–167 (Section 2)
* **Discrepancy Description:** `ScheduleCycle` freezes `rosterSnapshot`, but omits `blackoutsSnapshot: MemberBlackout[]` and diagnostic output for unassigned slots.
* **Recommendation:** Add `blackoutsSnapshot: MemberBlackout[];` and optional `solverDiagnostics?: Record<string, string>;`.

### Finding 9: Isolated `ImportModal` in Mermaid Diagram (🟢 Nit)
* **Affected Scope:** Lines 79–119
* **Recommendation:** Add `ImportModal --> Store` in the Mermaid diagram.

### Finding 10: Conflation of Half-Year vs. Annual Targets in Stage 3 (🟢 Nit)
* **Affected Scope:** Lines 200–206
* **Recommendation:** Clarify target: ~5–6 per FT member in H1/H2 (~11–12 annually).

### Finding 11: Clarify Friday Weekend vs. Mid-Week Rest Clause (🟢 Nit)
* **Affected Scope:** Line 220
* **Recommendation:** Clarify that Friday rest is checked in Stage 3 (weekend assignment), while Stage 5 enforces Wed/Thu rest.

### Finding 12: Modern CSS Print Property Syntax (🟢 Nit)
* **Affected Scope:** Line 267
* **Recommendation:** Include both `break-after: page;` and `page-break-after: always;`.

### Finding 13: Include Columbus Day in Stage 2 Exemplar (🟢 Nit)
* **Affected Scope:** Line 197
* **Recommendation:** Update parenthetical to `(Memorial Day, Labor Day, Columbus Day)`.

### Finding 14: Resolve Policy on Administrative Exemption Overrides (OQ-2) (🟢 Nit)
* **Affected Scope:** Lines 42–43
* **Recommendation:** Confirm manual overrides allow admin to force an Alternate on weekdays with a prominent red badge and an export footnote *"Administrative Exemption: Manual Alternate Weekday Assignment"*.
