# Stage 6: Comprehension Test Report

* **Target File:** `docs/designs/fire_marshal_scheduler.md`
* **Date:** 2026-11-05
* **Reviewer:** `egm-comprehension`

---

## Feature Specification Paraphrase

### What this proposes
The feature specification proposes a portable, offline, single-file HTML5 web application (`index.html`) to automate and manage 6-month and annual 24/7 on-call duty scheduling for Pennsylvania State Police (PSP) Fire Marshals. Operating without external servers, runtime dependencies, or cloud services, it combines browser-native IndexedDB storage, administrative roster and date-range blackout management, a dedicated 5-stage Stratified Constraint Satisfaction Problem (CSP) solver executing under 50ms, bidirectional spreadsheet interoperability via an inlined SheetJS engine matching traditional 7-column barracks wall calendars, and print stylesheets for physical station postings.

### How the existing system work, per this document
According to the document, barracks duty rosters are currently drafted and maintained manually across complex spreadsheets by unit administrators, covering continuous 24/7 on-call duty using small rosters of 3 to 4 Full-Time (FT) investigators and occasional Alternates (ALT). Manual scheduling regularly results in scheduling conflicts, unbalanced weekend assignments, and inadvertent violations of contractual rest mandates—most notably the 4-day compensatory rest invariant earned after working weekend duty, which legally blocks a member from Wednesday through Friday shifts. Furthermore, mid-cycle personnel departures (such as dropping from 4 to 3 active FT members) create severe scheduling bottlenecks when vacations occur, while enterprise security and network isolation policies prohibit installing native executables or accessing cloud-hosted SaaS tools on state police networks.

---

## Implementation Plan Paraphrase

### What this proposes
The implementation plan details the creation of a zero-dependency, single-file application (`index.html`) under 2.0 MB containing inlined CSS, SheetJS, reactive state management, an IndexedDB adapter (`PSP_Scheduler_DB`), UI drawers, conflict evaluators, and the 5-stage CSP scheduling engine. It pairs this application with an offline browser-based test suite (`tests/solver_test.html`) to validate solver constraints, quota allocations, rest invariants, and regression parity against `calendar_2027_reference.csv`, alongside an administrative operational manual (`docs/USER_GUIDE.md`). Verification is conducted through direct `file:///` filesystem execution in modern browsers under air-gapped conditions, Excel import/export round-trip fidelity checks, and simulated manual override conflict detection.

---

## Findings

### Finding 1: Undefined Algorithmic Acronym "MRV"
* **Severity**: Major
* **Affected Scope**: Section 3 (The 5-Stage Stratified CSP Solver Algorithm), Stage 2, Step 2, [line 195](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L195)
* **Discrepancy Description & Rationale**:
  Stage 2 states: *"Assign exactly 3 weekends per Alternate in H1 and 3 in H2 (MRV)."* The acronym `MRV` is introduced without definition or context. It should be written out as "Minimum Remaining Values (MRV)" with an explanation that alternates with the fewest available non-blacked-out weekends are prioritized first.

### Finding 2: Unspecified Abstraction for "Phase 1" vs. "Phase 2" Solver Logic
* **Severity**: Major
* **Affected Scope**: Section 3 (The 5-Stage Stratified CSP Solver Algorithm), Stage 4, Steps 1–3, [lines 210-213](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L210-L213); Section 2 (Database Schema), [lines 127-135](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L127-L135)
* **Discrepancy Description & Rationale**:
  Stage 4 branches on "Phase 1" vs. "Phase 2" logic, but the document does not formally define how Phase 1 vs. Phase 2 is determined programmatically (e.g. by checking active FT headcount where $\ge 4$ FT members is Phase 1, and 3 FT members is Phase 2, or explicit phase date boundaries). The condition delineating Phase 1 from Phase 2 must be made explicit.

### Finding 3: Orphaned Data Schema Fields (`preferred_weekend` and `premium`)
* **Severity**: Major
* **Affected Scope**: Section 2 (Embedded Database Schema), `MemberBlackout`, [line 143](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L143); `EnlistedHoliday`, [line 153](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L153)
* **Discrepancy Description & Rationale**:
  `MemberBlackout.type` defines `'preferred_weekend'` and `EnlistedHoliday` defines `premium: boolean`. The solver algorithm does not specify how preferred weekends are prioritized in Stage 2/3, and Non-Goal NG-3 excludes payroll/overtime so `premium` is unused. These fields should be clearly connected to solver heuristics or cleaned up.

### Finding 4: Rationale Gap in "4-Day Post-Weekend Rest" vs. 3-Day Shift Ban (Wed–Fri)
* **Severity**: Nit
* **Affected Scope**: Section "The Problem", [line 16](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L16); Stage 5, Step 2, [line 220-221](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L220-L221)
* **Discrepancy Description & Rationale**:
  Explain that after working weekend on-call duty, an FT member's standard departmental schedule places them on Regular Days Off (RDO) Thursday through Sunday, and under on-call rules they are prohibited from taking on-call shifts on Wednesday (day prior to RDO), Thursday, and Friday.

### Finding 5: Undefined Methodology Acronym "EGM"
* **Severity**: Nit
* **Affected Scope**: Line 415 ([line 415](file:///c:/Users/polch/Work_Calendar/docs/designs/fire_marshal_scheduler.md#L415))
* **Discrepancy Description & Rationale**:
  Expand or remove the `*Drafted with EGM*` footer note.
