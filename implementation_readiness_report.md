# Stage 9: Implementation Readiness Test Report

* **Target File:** `docs/designs/fire_marshal_scheduler.md` (lines 323–415)
* **Date:** 2026-11-05
* **Reviewers:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Mode:** `IMPLEMENTATION_READINESS`
* **Standards Applied:** `implementation-readiness-standard`

---

## Executive Summary

The Detailed Implementation Plan provides strong architectural breadth for single-file deployment, but contains one critical Blocker regarding automated parity regression testing against historical spreadsheets, alongside four Major gaps concerning interface contracts, phased staging, and SheetJS packaging.

---

## Prioritized Findings

### Finding 1: Direct Contradiction Between Parity Regression and Domain Invariants (🔴 Blocker)
* **Affected Scope:** Lines 350, 377–386 (`tests/solver_test.html` and `Verification Plan`)
* **Discrepancy Description:** 
  Line 350 specifies: *"Parity regression: Validate generated assignments against `calendar_2027_reference.csv` for 2027 H1."*
  However, the reference spreadsheet `calendar_2027_reference.csv` contains multiple historical manual deviations that violate the hard constraints defined in `scheduling_spec_2027.md` and the design's own invariants:
  1. **Lookahead Alternate Violation:** Terek is on approved leave Jun 26–Jul 3. The spec mandates an Alternate on the prior weekend (Jun 25–27). In the CSV (line 80), Polcha is assigned.
  2. **Blackout Clash:** Wolfe is off Feb 22–26 (Spec Section 6). In the CSV (line 24), Wolfe is assigned on Wed Feb 24.
  3. **Phase 1 Attached Holiday Deviation:** Spec Section 3 mandates that the weekend worker covers attached Monday holidays. In the CSV, Wolfe worked Jan 15–17, but Polcha worked MLK Day; Terek worked Feb 12–14, but Polcha worked Presidents' Day.
  An automated test asserting exact assignment parity against the CSV will fail or force the solver to violate its own core constraints.
* **Recommendation:** Differentiate between **Import Fidelity Testing** and **Algorithmic Parity Testing**. Retain the CSV as an import test fixture (verifying all 181 days parse and aliases are identified). Modify the solver test to assert constraint invariants (zero unassigned days, zero rest violations, exactly 3 weekends per ALT, non-consecutive weekends, and proactive lookahead satisfaction).

### Finding 2: Lack of Component Contracts and Initialization Lifecycles (🟡 Major)
* **Affected Scope:** Lines 327–341 (`index.html` Target Components)
* **Discrepancy Description:** The implementation plan enumerates 10 major subsystems but does not specify their interface boundaries, method signatures, or initialization sequence.
* **Recommendation:** Define explicit module interfaces and state initialization lifecycles (or unidirectional action signatures) so implementation proceeds without ambiguity.

### Finding 3: Missing Phased Implementation Milestones and Staging Sequence (🟡 Major)
* **Affected Scope:** Lines 323–371 (`Detailed Implementation Plan`)
* **Discrepancy Description:** The plan jumps directly from file lists to verification without establishing an incremental, testable roadmap.
* **Recommendation:** Structure implementation into 5 testable milestones:
  1. Storage & State Core
  2. Algorithmic Solver & Standalone Test Runner
  3. Calendar & Administrative UI Drawers
  4. Excel/Spreadsheet Engine & Name Resolver Modal
  5. Print Styling & User Manual.

### Finding 4: Unspecified Sourcing Strategy for Inlined SheetJS (🟡 Major)
* **Affected Scope:** Lines 331, 374–376
* **Discrepancy Description:** The design calls for inlining minified SheetJS (`xlsx.full.min.js`, ~1.1MB) into `index.html`, but does not specify how this asset is acquired or staged in an offline repository.
* **Recommendation:** Document vendor acquisition (e.g., downloading standalone `xlsx.full.min.js` v0.18.5 into a local vendor staging directory prior to packaging).

### Finding 5: Code Reusability and Test Isolation Gap (🟡 Major)
* **Affected Scope:** Lines 342–351 (`tests/solver_test.html`)
* **Discrepancy Description:** The plan does not describe how `tests/solver_test.html` accesses `CSPSolver` without either code duplication or modular imports.
* **Recommendation:** Define a clean shared structure (e.g. `src/csp_solver.js` loaded by both `solver_test.html` and bundled into `index.html`, or exposing `window.CSPSolver`).

### Finding 6: Omission of Historical Alias `RILEY` in Import Test (🟢 Nit)
* **Affected Scope:** Line 388
* **Discrepancy Description:** `calendar_2027_reference.csv` contains `RILEY` on line 74 (May 31, 2027). The verification plan mentions only `KEEBAUGH`.
* **Recommendation:** Include both `KEEBAUGH` and `RILEY` in the import verification test cases.

### Finding 7: User Guide Mapping to CUJs (🟢 Nit)
* **Affected Scope:** Lines 352–363 (`docs/USER_GUIDE.md`)
* **Recommendation:** Explicitly cross-reference the 5 Critical User Journeys (CUJs) in the User Guide table of contents.

### Finding 8: Deterministic Test Runner Output Assertion (🟢 Nit)
* **Affected Scope:** Lines 378–386
* **Recommendation:** Specify explicit DOM `#test-results[data-status="PASS"]` and console summary output for headless/browser inspection.
