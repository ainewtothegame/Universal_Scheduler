# Stage 8: Intermediate Zoom Out Review Report

* **Target Document:** `docs/designs/fire_marshal_scheduler.md` (Full file, lines 1–415)
* **Date:** 2026-11-05
* **Reviewer:** `egm-zoom-out` (Skeptical Architect)
* **Review Standard:** Zoom-Out Standard (Simplicity, Anti-Weeds, YAGNI, Code Minimization, Architectural Sanity)

---

## 1. Executive Summary & Cross-Stage Synthesis

Across Stages 5 through 9, the proposed architecture for the Pennsylvania State Police (PSP) Fire Marshal Scheduler has been thoroughly audited. The core concept—a 100% offline, zero-dependency, single-file HTML5 application (`index.html`) driven by a deterministic 5-stage heuristic CSP solver—remains sound and responsive to enterprise workstation constraints.

This Intermediate Zoom Out Review reconciles the findings, firmly establishes the necessary architectural simplifications, eliminates weeds, and provides a clear architectural baseline for finalizing the design document.

---

## 2. Architectural Simplifications Audit & Verification

### A. Unified State Model vs. Normalized Multi-Store Database
* The schedule for an entire year across 6–7 personnel, 15 leave blocks, and 365 daily string assignments amounts to under 40 KB of JSON. Maintaining 5 separate IndexedDB stores (`roster`, `blackouts`, `holidays`, `schedules`, `snapshots`) with asynchronous transactions, foreign keys, and version migrations is classic enterprise over-engineering.
* **Simplification:** Collapse storage into a single unified root state object (`AppState` containing `{ roster, blackouts, holidays, cycles, activeCycleId }`). Persist this object atomically to browser storage (`localStorage` or a single IndexedDB key `psp_state_v1`). This makes state mutations synchronous in memory, eliminates partial-write corruption, and reduces backup/restore to a single `JSON.stringify` / `JSON.parse` operation.

### B. In-Memory Undo Stack vs. Storage Snapshot Bloat
* Section 5 (Line 318) specifies writing full-state snapshots to disk on every single cell click.
* **Simplification:** Decouple session undo/redo from persistent storage. Implement an in-memory stack (`undoStack = []`, `redoStack = []`) capped at 30–50 actions. Storage persistence should occur upon meaningful state transitions (debounced edits, manual saves, cycle switches, or schedule regeneration). Persistent snapshots should be reserved strictly for user-created named checkpoints (e.g., "Pre-Summer Final").

### C. Phase 1 vs. Phase 2 Gating & Solver Decoupling
* In Phase 2, FT weekends cover Fri–Mon (4 days). Statically seeding mid-week days (`Mon=Polcha, Tue=Terek, Thu=Terek`) in Stage 5 directly overwrites Phase 2 Monday holiday settlements and assigns Terek to 67% of mid-week shifts.
* **Simplification:** 
  - **Phase 1 (Jan 1 – Feb 28, 4 FT active):** Weekend duty is Fri–Sun (3 days). Monday is an attached holiday (covered by weekend worker) or standard weekday. Weekdays are seeded by baseline preferences and swapped if rested/blacked out.
  - **Phase 2 (Mar 1 – Dec 31, 3 FT active):** Weekend duty is Fri–Mon (4 days). Stage 1 lookahead triggers proactively only during Phase 2 (or when active FT < 4) prior to full-week/multi-day leaves, immediately decrementing the assigned Alternate's 3-weekend quota. Mid-week allocation (Tue–Thu) in Stage 5 operates strictly on remaining unassigned slots via dynamic round-robin equity among rested FT members, never static hardcoded seeding.

### D. Algorithmic Invariant Testing vs. Historical Spreadsheet Overfitting
* The reference CSV contains historical human errors (e.g. Terek leave without lookahead, Wolfe assigned during blackout, attached holiday deviations). Asserting literal CSV equality would force the solver to violate its own contractual constraints.
* **Simplification:** Separate **Import Fidelity Testing** from **Algorithmic Correctness Testing**. The CSV is strictly an import fixture (verifying parser robustness and alias resolution for `KEEBAUGH` and `RILEY`). Algorithmic unit tests must assert mathematical domain invariants: zero post-weekend rest violations, 100% shift coverage, exactly 3 weekends per ALT per half, zero consecutive weekends, and lookahead satisfaction.

---

## 3. Anti-Weeds & Anti-Scope Creep Guardrails

1. **Reject Build System / Bundler Creep:** The domain engine (`src/csp_solver.js` or inlined script) can be maintained as a clean standalone ES module loaded via native `<script type="module">` in both `index.html` and `solver_test.html`. Zero npm or bundler prerequisites.
2. **Prevent Architecture Document Altitude Drops (Weeds):** The design document must define data structures, module responsibilities, and data flows, remaining focused on high-level architecture without low-level function signature catalogs.
3. **Avoid Over-Engineered Fuzzy Matching (YAGNI):** Drop Levenshtein distance for 6–7 personnel; use a simple `<select>` dropdown.
4. **Purge Orphaned Fields:** Remove `EnlistedHoliday.premium` and clarify `MemberBlackout.type`.

---

## 4. Prioritized Architectural Findings

### Finding 1: Stage 5 Seeding Contradicts Phase 2 Monday Invariants & Equity (🔴 Blocker)
* **Severity:** Blocker
* **Affected Scope:** Lines 208–229 (Section 3, Stages 4 & 5)
* **Resolution:** Decouple mid-week allocation by phase: Phase 1 uses baseline preferences; Phase 2 dynamically rotates unassigned mid-week slots (Tue–Thu) among rested FT members using simple round-robin equity.

### Finding 2: Direct Contradiction Between CSV Parity Regression and Domain Invariants (🔴 Blocker)
* **Severity:** Blocker
* **Affected Scope:** Line 350, Lines 377–386 (Section 1.2 & Verification Plan)
* **Resolution:** Automated solver tests must assert strict rule invariants; the CSV must be used solely to verify spreadsheet parsing and unmatched-name resolution.

### Finding 3: Database Over-Engineering (5-Store IndexedDB vs. Unified JSON Document) (🟡 Major)
* **Severity:** Major
* **Affected Scope:** Lines 121–177 (Section 2)
* **Resolution:** A single root document (`AppState`) serialized to `localStorage` or a single IndexedDB key provides atomic transactions, simplicity, and instant JSON backup/restore.

### Finding 4: Storage Snapshot Bloat vs. In-Memory Undo Stack (🟡 Major)
* **Severity:** Major
* **Affected Scope:** Lines 169–176, Lines 318–320
* **Resolution:** Manage undo/redo in memory (capped at 30–50 states); persistent snapshots created only explicitly by user or on major lifecycle events.

### Finding 5: Lookahead Alternate Allocation Quota Accounting & Phase Gating (🟡 Major)
* **Severity:** Major
* **Affected Scope:** Lines 184–198 (Section 3, Stages 1 & 2)
* **Resolution:** Stage 1 lookahead triggers only during Phase 2 (or when active FT < 4) and immediately decrements the assigned Alternate's 3-weekend quota pool before Stage 2 executes.

### Finding 6: Omission of Attached Friday Holidays from Settlement (🟡 Major)
* **Severity:** Major
* **Affected Scope:** Lines 208–215 (Section 3, Stage 4)
* **Resolution:** Explicitly bind Attached Friday holidays (New Year's Day, Good Friday) to the weekend worker in Stage 4.

### Finding 7: Algorithmic Overkill: Fuzzy String Distance for 6 Personnel (🟢 Nit)
* **Severity:** Nit
* **Affected Scope:** Lines 250–254, Line 339
* **Resolution:** Replace with clean `<select>` dropdown in Unmatched-Name Resolution modal.

### Finding 8: Closure of Open Questions OQ-1 & OQ-2 (🟢 Nit)
* **Severity:** Nit
* **Affected Scope:** Lines 39–43
* **Resolution:** OQ-1 resolved (mid-week holidays are standard FT duties). OQ-2 resolved (manual overrides allow forcing an Alternate with a red badge and export footnote).
