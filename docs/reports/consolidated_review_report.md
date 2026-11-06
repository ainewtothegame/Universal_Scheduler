# Consolidated Review Report: Fire Marshal On-Call Schedule Generator & Editor

* **Target Document:** [`docs/designs/fire_marshal_scheduler.md`](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md)
* **Date:** 2026-11-05
* **Review Mode:** Uninterrupted Full Flow
* **Review Stages Executed:**
  1. Stage 5: Initial Zoom Out Review ([`zoom_out_report.md`](zoom_out_report.md))
  2. Stage 6: Comprehension Test ([`comprehension_report.md`](comprehension_report.md))
  3. Stage 7: Critic Review ([`critic_report.md`](critic_report.md))
  4. Stage 8: Intermediate Zoom Out Review ([`intermediate_zoom_out_report.md`](intermediate_zoom_out_report.md))
  5. Stage 9: Implementation Readiness Test ([`implementation_readiness_report.md`](implementation_readiness_report.md))

---

## Executive Summary

The proposed architecture in `docs/designs/fire_marshal_scheduler.md` establishes a strong, viable foundation for an air-gapped, zero-dependency, single-file (`index.html`) on-call duty scheduling application. The design accurately captures the complex fatigue and rest requirements of the Pennsylvania State Police, notably the 4-day compensatory post-weekend rest rule and strict Alternate quotas.

Through cross-stage synthesis, **2 Blockers**, **8 Major findings**, and **4 Nits** were identified and consolidated into an actionable remediation matrix. Resolving these discrepancies eliminates algorithmic contradictions, simplifies persistence, and hardens the specification for immediate implementation.

---

## Traceability Matrix

| Action Item ID | Priority | Description | Source Stage(s) | Target Scope in Design Doc |
| :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | 🔴 Blocker | Decouple Algorithmic Parity Testing from Historical CSV Errors | Stage 8 #2, Stage 9 #1 | Section 1.2, Verification Plan (Lines 350, 377–386) |
| **ACT-02** | 🔴 Blocker | Align Stage 5 Mid-Week Seeding with Phase 2 Monday Invariants & Equity | Stage 7 #1, Stage 8 #1 | Section 3: Stages 4 & 5 (Lines 208–229) |
| **ACT-03** | 🟡 Major | Collapse 5-Store IndexedDB Schema into Unified `AppState` Document | Stage 5 #1, Stage 8 #3 | Section 2: Schema (Lines 121–177) |
| **ACT-04** | 🟡 Major | Decouple Undo/Redo from Persistent Storage to In-Memory Stack | Stage 5 #2, Stage 8 #4 | Section 2, Section 5 (Lines 169–176, 318–320) |
| **ACT-05** | 🟡 Major | Formalize Lookahead Quota Accounting & Phase 2 Trigger Gating | Stage 5 #3, Stage 7 #5, Stage 8 #5 | Section 3: Stages 1 & 2 (Lines 184–198) |
| **ACT-06** | 🟡 Major | Bind Attached Friday Holidays to Weekend Worker in Solver Pipeline | Stage 7 #2, Stage 8 #6 | Section 3: Stage 4 (Lines 208–215) |
| **ACT-07** | 🟡 Major | Define MRV Acronym & Make `baselineWeekday` Nullable for Alternates | Stage 6 #1, Stage 7 #4 | Section 2 & 3 (Lines 133, 195) |
| **ACT-08** | 🟡 Major | Add Missing Contractual Checks to `ConflictEngine` | Stage 7 #6 | Section 5: Conflict Engine (Lines 255–262) |
| **ACT-09** | 🟡 Major | Specify SheetJS Numeric Date Parsing (`cellDates: true`) & Column Alignment | Stage 7 #7 | Section 4.B: Import Engine (Lines 247–254) |
| **ACT-10** | 🟡 Major | Add Blackout Snapshots to `ScheduleCycle` & Define Phased Staging | Stage 7 #8, Stage 9 #3 | Section 2 & Detailed Implementation Plan |
| **ACT-11** | 🟢 Nit | Replace Levenshtein Distance with Simple Dropdown Selection | Stage 5 #4, Stage 8 #7 | Section 4.B (Lines 250–254) |
| **ACT-12** | 🟢 Nit | Formally Close Open Questions OQ-1 and OQ-2 | Stage 5 #6, Stage 7 #3, Stage 8 #8 | Section: Open Questions (Lines 39–43) |
| **ACT-13** | 🟢 Nit | Clarify Duty Week Context for "4-Day Rest" vs. 3-Day Ban (Wed–Fri) | Stage 6 #4, Stage 7 #11 | Section: Problem & Stage 5 (Lines 16, 220) |
| **ACT-14** | 🟢 Nit | Align User Guide Table of Contents with Critical User Journeys (CUJs) | Stage 9 #7 | Section: Target Files (Lines 352–363) |

---

## Detailed Consolidated Action Items

### 🔴 Blockers

#### ACT-01: Decouple Algorithmic Parity Testing from Historical CSV Errors
* **Problem:** Line 350 directed `tests/solver_test.html` to validate generated assignments against `calendar_2027_reference.csv` for 2027 H1. The historical CSV contains several human scheduling errors and contractual deviations (e.g. Terek leave without lookahead, Wolfe assigned during blackout, attached holiday deviations). Asserting literal 1:1 cell parity forces the automated solver to violate its own core rules.
* **Resolution:** 
  1. Designate `calendar_2027_reference.csv` strictly as an **Import & Parsing Test Fixture** (verifying that all 181 days parse accurately and aliases `KEEBAUGH` and `RILEY` trigger the name resolution modal).
  2. Direct the algorithmic test suite (`tests/solver_test.html`) to assert strict **Mathematical Domain Invariants**:
     - 100% daily coverage (zero unassigned slots).
     - Zero post-weekend rest violations across all days.
     - Exactly 3 weekends per Alternate in H1 (9 total).
     - Zero consecutive weekends for any personnel.
     - Proactive Alternate lookahead assignment on May 7–9 and Jun 25–27.

#### ACT-02: Align Stage 5 Mid-Week Seeding with Phase 2 Monday Invariants & Workload Equity
* **Problem:** Stage 5 Step 1 statically seeded mid-week slots with hardcoded baseline preferences (`Mon=Polcha, Tue=Terek, Thu=Terek`). In Phase 2, FT weekend shifts cover Friday through Monday (4 days), and Stage 4 already settles attached/non-holiday Mondays. Re-seeding `Mon=Polcha` in Stage 5 overwrites Stage 4 and breaches the 4-day weekend boundary, while statically assigning `Tue=Terek, Thu=Terek` permanently hands Terek 67% of mid-week shifts, violating contractual rotation equity.
* **Resolution:** 
  1. Stage 5 must strictly process unassigned mid-week slots (Tue–Thu in Phase 2; Tue–Thu plus non-holiday Mon in Phase 1).
  2. In Phase 1 (4 FT members active), seed baseline weekday preferences and swap among available FT members to resolve rest/blackout conflicts.
  3. In Phase 2 (3 FT members active), allocate unassigned Tue–Thu shifts dynamically using a balanced round-robin equity pool across rested FT members, never hardcoded static seeding.

---

### 🟡 Major Discrepancies

#### ACT-03: Collapse 5-Store IndexedDB Schema into Unified `AppState` Document
* **Problem:** The entire dataset for an annual barracks schedule is under 40 KB of JSON. Maintaining 5 normalized tables in IndexedDB (`roster`, `blackouts`, `holidays`, `schedules`, `snapshots`) introduces unnecessary asynchronous transaction overhead, schema migration risks, and entity join boilerplate.
* **Resolution:** Replace the 5 object stores with a single unified root state model:
  ```typescript
  interface AppState {
    roster: RosterMember[];
    blackouts: MemberBlackout[];
    holidays: EnlistedHoliday[];
    cycles: Record<string, ScheduleCycle>;
    activeCycleId: string;
    savedSnapshots: Record<string, ScheduleSnapshot>;
  }
  ```
  Persist this state atomically to browser storage (`localStorage` or a single IndexedDB key `psp_state_v1`). State mutations in memory become synchronous, partial-write corruption is impossible, and export/import becomes a 1-line JSON serialization.

#### ACT-04: Decouple Undo/Redo from Persistent Storage to In-Memory Stack
* **Problem:** Writing full deep-copy snapshots to browser storage on every cell edit causes storage bloat, requires pruning routines, and creates I/O thrashing.
* **Resolution:** Maintain undo/redo in an in-memory stack (`undoStack = []`, `redoStack = []`) capped at 30–50 states during the active browser session. Persistent storage occurs upon debounced edits, schedule generation, or cycle switching. Persistent snapshots are reserved exclusively for explicit user-created named checkpoints.

#### ACT-05: Formalize Lookahead Quota Accounting & Phase 2 Trigger Gating
* **Problem:** Stage 1 lookaheads (assigning an Alternate to Weekend $W-1$ before an FT leave week) did not explicitly decrement the Alternate's 3-weekend half-year quota in Stage 2, and were not gated to Phase 2 (in Phase 1, 4 FTs are active, so leave by 1 FT does not trigger a rest deadlock).
* **Resolution:**
  1. Gate proactive lookaheads strictly to Phase 2 (or scenarios where active FT headcount $< 4$) for leave blocks spanning $\ge 3$ consecutive mid-week days or full weeks.
  2. Explicitly specify that placing an Alternate on Weekend $W-1$ in Stage 1 immediately consumes 1 of that Alternate's 3 allocated weekend credits for that half-year cycle prior to executing Stage 2.

#### ACT-06: Bind Attached Friday Holidays to Weekend Worker in Solver Pipeline
* **Problem:** Stage 4 focused exclusively on Attached Mondays, omitting official Attached Friday holidays codified in state police regulations: New Year's Day (Fri Jan 1) and Good Friday (Fri Mar 26).
* **Resolution:** Rename Stage 4 to *"Attached Holiday (Fri/Mon) & Monday Shift Settlement"* and specify that Attached Friday holidays are bound directly to the assigned weekend worker (FT or ALT) during Stage 3 / Stage 4.

#### ACT-07: Define MRV Acronym & Make `baselineWeekday` Nullable for Alternates
* **Problem:** The acronym `MRV` in Stage 2 was undefined. In the `RosterMember` schema, `baselineWeekday: number;` was non-nullable, forcing dummy values for Alternates who never work standard weekdays.
* **Resolution:** Define MRV as *Minimum Remaining Values (prioritizing Alternates with the fewest available non-blacked-out weekends first)*. Update schema to `baselineWeekday?: number | null;`.

#### ACT-08: Add Missing Contractual Checks to `ConflictEngine`
* **Problem:** The real-time conflict evaluator omitted checks for Alternate weekday assignments, Alternate quota breaches, and tenure boundary clashes.
* **Resolution:** Add red conflict indicators for:
  - `ALT_WEEKDAY_VIOLATION`: Alternate manually placed on Mon–Thu (outside attached Monday holidays).
  - `ALT_QUOTA_EXCEEDED`: Alternate exceeding 3 weekends in a half-year.
  - `TENURE_BOUNDARY_VIOLATION`: Member assigned outside their active start/end window (e.g. Kemerer after Feb 28, or Keebaugh).

#### ACT-09: Specify SheetJS Numeric Date Parsing & Column Alignment
* **Problem:** By default, SheetJS returns date codes as numeric floats unless `cellDates: true` is configured. Also, `calendar_2027_reference.csv` contains an empty leading column A.
* **Resolution:** Specify `cellDates: true` in the SheetJS workbook read options and require dynamic column alignment relative to the detected `MONDAY` token.

#### ACT-10: Add Blackout Snapshots to `ScheduleCycle` & Define Phased Staging
* **Problem:** `ScheduleCycle` did not freeze leave entries, allowing future leave edits to alter historical schedules. The implementation plan also lacked incremental execution phases.
* **Resolution:** Add `blackoutsSnapshot: MemberBlackout[];` and `solverDiagnostics?: Record<string, string>;` to `ScheduleCycle`. Structure implementation into 5 testable milestones:
  1. Persistence & State Core
  2. Algorithmic Solver & Test Runner
  3. Calendar & Administrative UI
  4. Spreadsheet Engine & Name Resolver Modal
  5. Print Styling & User Manual.

---

### 🟢 Nits

#### ACT-11: Replace Levenshtein Distance with Simple Dropdown Selection
* Drop algorithmic string matching for an operational roster of 6–7 investigators; use a clean `<select>` dropdown populated with active/historical roster members.

#### ACT-12: Formally Close Open Questions OQ-1 and OQ-2
* Close OQ-1: Mid-week holidays (Election Day, Veterans Day, Thanksgiving) are standard weekday shifts covered by regular FT rotation without special weighting.
* Close OQ-2: Manual overrides permit placing an Alternate into a weekday shift, flagged with a prominent red badge and an automatic export footnote *"Administrative Exemption: Manual Alternate Weekday Assignment"*.

#### ACT-13: Clarify Duty Week Context for "4-Day Rest" vs. 3-Day Ban (Wed–Fri)
* Clarify that working weekend on-call duty entitles an FT member to Regular Days Off (RDO) Thursday through Sunday; on-call rules prohibit them from taking shifts on Wednesday (day prior to RDO), Thursday, and Friday. Friday rest is enforced during Stage 3 weekend assignment; Wed/Thu rest is enforced during Stage 5 mid-week assignment.

#### ACT-14: Align User Guide Table of Contents with Critical User Journeys (CUJs)
* Cross-reference chapters in `docs/USER_GUIDE.md` directly to CUJ 1 through CUJ 5. Specify standard DOM `#test-results[data-status="PASS"]` and console summary output in `tests/solver_test.html`.

---

## Conclusion & Next Steps

With all 14 findings synthesized, prioritized, and linked to concrete remediation actions, the review pipeline is complete. Applying these approved updates to [`docs/designs/fire_marshal_scheduler.md`](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md) will fully harden the technical design for production implementation.
