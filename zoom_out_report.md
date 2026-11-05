# Stage 5: Initial Zoom Out Review Report

* **Target Document:** `docs/designs/fire_marshal_scheduler.md`
* **Date:** 2026-11-05
* **Reviewer:** `egm-zoom-out`
* **Review Standard:** Zoom-Out Standard (Simplicity, Minimalism, Anti-Weeds, YAGNI, Code Minimization)

---

## Executive Summary

The proposed architecture in `fire_marshal_scheduler.md` accurately models the strict 4-day compensatory rest invariants, respects the offline enterprise deployment constraints of the Pennsylvania State Police (PSP), and rightly rejects heavyweight external dependencies (such as WASM-based ILP solvers or cloud APIs). The 5-stage stratified heuristic solver is pragmatic, deterministic, and mirrors barracks command workflows.

However, several subsystems exhibit noticeable over-engineering, premature complexity, and YAGNI violations:
1. Normalizing ~30 KB of data into a 5-store relational schema in IndexedDB adds substantial asynchronous plumbing where a single, unified JSON document structure in `localStorage` or a single-key storage would suffice.
2. Persisting full-cycle snapshot deep copies into IndexedDB on every single manual edit introduces unnecessary database overhead for what should be a simple in-memory session undo stack.
3. Proposing Levenshtein-distance fuzzy string matching to reconcile names across an operational unit of only 6–7 personnel is textbook over-engineering.
4. Solver Stage 1 lookahead alternate allocation needs explicit accounting against Stage 2 quotas and proper phase gating.

---

## Detailed Findings

### Finding 1: IndexedDB with 5 Normalized Object Stores vs. Unified JSON Document
* **Severity:** Major
* **Affected Scope:** Section 2: Embedded Database Schema (Lines 121–177), Section 1: Component Flow (Lines 100–103), Section 1.1: Target Files (Line 333).
* **Rationale:** The total dataset for an entire annual schedule—encompassing 7 personnel (4 FT, 3 ALT), ~15–20 leave blocks, 13 holidays, and 365 daily string assignments—is roughly 25–40 KB of JSON. Splitting this miniature dataset across 5 relational tables in IndexedDB forces the client JavaScript to perform manual entity joins, asynchronous transaction management, schema version migrations, and complex error handling.
* **Recommendation:** Replace the 5-table relational schema with a single unified document model (`AppState` containing `{ roster, blackouts, holidays, activeCycle }`). Persist this single state object via `localStorage` (or a single key in IndexedDB). This eliminates async transaction boilerplate, prevents partial write corruptions, and makes backup/restore a trivial 1-line JSON parse/stringify operation.

### Finding 2: Infinite Snapshot Persistence in Storage
* **Severity:** Major
* **Affected Scope:** Section 2: `ScheduleSnapshot` Object Store (Lines 169–176), Section 5: Reliability & Atomic Versioning (Lines 318–320).
* **Rationale:** The design specifies writing full snapshots to persistent storage on every single cell click. This creates unbounded storage accumulation and requires snapshot pruning, garbage collection, and custom rollback UI.
* **Recommendation:** Decouple undo/redo from persistent storage. Implement undo/redo using an in-memory history stack (`undoStack = []`, `redoStack = []`) capped at 30–50 states. Only persist the current schedule state and explicit user-named save checkpoints (`Named Snapshots`) when the user explicitly clicks "Save Snapshot" or creates a new cycle.

### Finding 3: Solver Stage 1 Lookahead Quota Coupling & Phase Scoping
* **Severity:** Major
* **Affected Scope:** Section 3: The 5-Stage Stratified CSP Solver Algorithm (Lines 181–198).
* **Rationale:** In Stage 1, the solver detects full-week FT leaves (e.g., Wolfe May 10–14, Terek Jun 26–Jul 3) and proactively forces an Alternate onto Weekend $W-1$. The design does not explicitly declare that Stage 1 Alternate pre-allocations MUST decrement the remaining quota pool in Stage 2. Furthermore, in Phase 1 (Jan–Feb), 4 FT members are active; Stage 1's proactive Alternate placement must be explicitly gated to Phase 2 (or scenarios where available FT count $< 4$) to avoid unnecessarily burning Alternate weekend quotas during Phase 1.
* **Recommendation:** Clarify in Stage 1 that: (a) Proactive lookahead triggers only during Phase 2 (or when active FT count $< 4$), and (b) Any Alternate assigned in Stage 1 immediately consumes 1 of their allocated 3-weekend quota credits for that half-year cycle prior to executing Stage 2.

### Finding 4: Fuzzy Levenshtein Distance for a 6–7 Person Roster
* **Severity:** Nit / Code Minimization
* **Affected Scope:** Section 4.B: Dual-Format Import Pipeline (Lines 250–254), Section 1.1: Target Files (Line 339).
* **Rationale:** The entire operational unit consists of only 6 to 7 people: POLCHA, TEREK, WOLFE, KEMERER, CHESTER, ZEIDERS, REED (plus retired KEEBAUGH). Writing or bundling an algorithmic string-distance matcher to select among 6 known names adds unnecessary code weight.
* **Recommendation:** Drop the Levenshtein fuzzy matching algorithm. When an unrecognized name is detected during import, display a clean modal with a simple `<select>` dropdown populated with the active and inactive roster members, an option to add as a new historical member, or an option to leave blank.

### Finding 5: Pub/Sub Reactive Event Bus Indirection in Vanilla Single-File Web App
* **Severity:** Nit / Simplification
* **Affected Scope:** Section 1: High-Level Component & Data Flow Architecture (Lines 77–78, 90–93, 105–119).
* **Rationale:** In a single-file vanilla JavaScript application without a build system or framework, custom event buses often create debugging opacity (loose event strings, untraceable listener cascades, and dangling subscriptions).
* **Recommendation:** Adopt a straightforward unidirectional state-to-DOM pattern. Maintain a central `state` object with explicit action functions that mutate state and trigger targeted render functions.

### Finding 6: Resolution of Open Question OQ-1 from Specification
* **Severity:** Nit
* **Affected Scope:** Section: Open Questions (Lines 39–41).
* **Rationale:** `scheduling_spec_2027.md` Section 5 explicitly defines that General Election Day, Veterans Day, and Thanksgiving are standard weekday shifts covered by the regular FT rotation with no special weighting.
* **Recommendation:** Mark OQ-1 as resolved directly from the specification.
