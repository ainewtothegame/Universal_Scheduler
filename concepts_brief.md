# Fire Marshal On-Call Schedule Generator & Editor

* **Author:** POLCHA
* **Date:** 2026-11-05

## Overview

A 100% offline, single-file (`index.html`) web application to configure, generate, manually edit, and export on-call duty schedules for Pennsylvania State Police (PSP) Fire Marshals and Alternates. The application operates in flexible 6-month (semi-annual) or full 1-year blocks. It includes an administrative roster manager with historical version locking, a visual date-range blackout/availability picker, an automated 5-stage Stratified Constraint Satisfaction Problem (CSP) solver, an embedded browser database (IndexedDB) with snapshot versioning, and bidirectional Excel/spreadsheet import and export with unmatched-name resolution.

## Analysis

### 1. Delivery & Persistence Architecture
- **Single-File Distribution:** Packaged entirely into a single portable `index.html` file containing HTML, styling, JavaScript application runtime, and inlined SheetJS (`xlsx.full.min.js`). Runs locally off disk via `file:///` in modern browsers (Edge, Chrome) with zero network calls and zero installation barriers on restricted workstations.
- **Embedded Database (`PSP_Scheduler_DB`):** Uses IndexedDB to store personnel rosters, multi-day blackout ranges, holiday schedules, generated duty assignments, manual overrides, and named schedule snapshots with JSON backup/restore.
- **Immutable Historical Roster Locking:** Each scheduled block (6-month or full 1-year) stores its own frozen roster snapshot. Adding, transferring, or retiring members in a new cycle never alters past schedules or historical records.
- **Print & Barracks Posting:** Dedicated `@media print` layout formatting individual monthly calendar sheets into clean landscape printouts matching official PSP bulletin board specifications without web chrome or buttons.

### 2. Administrative Controls & Date-Range Booking
- **Roster Management:** Dynamic addition and editing of personnel with Full-Time (FT) or Alternate (ALT) designation, active tenure windows (e.g., Kemerer active Jan 1 – Feb 28, Keebaugh retired), color tags, and baseline weekday preferences.
- **Date-Range Booking UI:** Visual calendar range selector allowing single-click or drag-to-select booking for vacations, military leave, mandatory blackouts, and preferred weekend shifts.
- **Flexible Scheduling Horizons:** Support for generating schedules in either standard 6-month blocks (H1: Jan 1 – Jun 30, H2: Jul 1 – Dec 31) or a full 1-year block (Jan 1 – Dec 31).

### 3. Constraint Satisfaction Engine & Weekday Coverage Invariants
- **Daily Coverage:** Exactly 1 member on call per day (24/7).
- **FT Weekday Exclusivity:** Monday–Thursday shifts are strictly reserved for Full-Time members. Alternates are prohibited from working weekdays, except when an Alternate works a weekend with an attached Monday holiday.
- **Post-Weekend Compensatory Rest:** An FT member working a weekend cannot be assigned on-call duty on the Wednesday, Thursday, or Friday immediately following that weekend.
- **Consecutive Shifts & Workload Balancing:** An active Full-Time member may cover multiple mid-week shifts during the same week if manpower is constrained (e.g., due to colleague vacation or post-weekend rest). When an FT member is assigned multiple mid-week shifts, the UI displays a visible badge to bring it to the administrator's attention.
- **Weekend Quotas & Balance:** Exactly 3 weekends per Alternate per 6-month block (or 6 per full year); remaining weekends balanced across active FT members; strict prohibition of consecutive weekends.
- **Strategic Lookahead Heuristic:** When an FT member takes a full week off, the solver proactively places an Alternate on the preceding weekend to ensure the remaining FT members are rested and available to cover mid-week shifts.
- **Strict Rule Relaxation Policy:** The ONLY automated relaxation permitted is reallocating and combining weekday shifts among available Full-Time members. Compressing rest periods, assigning Alternates to weekdays, or exceeding Alternate weekend quotas is prohibited. If a deadlock cannot be resolved via FT reallocations, the solver halts and marks the unassigned slot with an interactive conflict diagnostic badge.

### 4. Excel & Spreadsheet Interoperability
- **Export:** Generates formatted `.xlsx` workbooks mirroring the operational PSP barracks layout (7-column Mon–Sun grid, date headers, personnel names, and operational footnote notes).
- **Dual-Format Import Parser:** Ingests spreadsheets exported from Microsoft Excel or Google Sheets in either of two supported structures:
  1. *Operational Calendar Grid Format:* Matches the 7-column (Mon–Sun) monthly grid format with interleaved dates, assignment names, and notes rows.
  2. *Tabular Date List Format:* Standard 2-column list (`Date`, `Assigned Member`).
- **Interactive Unmatched-Name Resolution Modal:** When historical files, retired members, transfer personnel, or typos are encountered during import, the UI displays an alias reconciliation modal allowing the administrator to map the alias to an existing member, register a historical record, or leave the slot unassigned.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  - 100% offline single-file `index.html` executable directly in any web browser without server setup.
  - Interactive dual-view calendar (6-month/1-year overview matrix and monthly 7-column grid).
  - Flexible scheduling blocks: 6-month or full 1-year generation.
  - Visual date-range picker for blackout and vacation scheduling.
  - 5-stage Stratified CSP solver with proactive lookahead alternate placement.
  - Multiple mid-week shift coverage permitted for FT members under tight constraints, with visual attention badges.
  - Immutable historical roster locking per scheduling block.
  - Embedded IndexedDB database with snapshot saving, restoring, and JSON data export.
  - Formatted Excel export and resilient Excel/CSV import with unmatched-name alias resolution.
  - Barracks-ready print stylesheet.

* **Out-of-Scope Non-Goals:**
  - Multi-user network synchronization or live cloud collaboration.
  - Direct live API integration with Google Workspace or Microsoft 365 (files imported via local `.xlsx`/`.csv`).
  - Payroll, timesheet tracking, or overtime rate calculations.
  - Assigning Alternates to mid-week shifts or violating post-weekend rest rules.

## Alternatives Weighed

* **Permissive Multi-Tier Constraint Relaxation:**
  - *Rejected by Author:* Union and operational safety rules prohibit cutting 4-day RDO or giving Alternates unauthorized weekday shifts. Permitting FT members to take multiple mid-week shifts with visual badges solves the manpower constraint cleanly.
* **Packaged Desktop Application (Electron / Tauri):**
  - *Rejected:* Single `index.html` runs natively in enterprise Edge/Chrome with zero administrative permissions or installer friction.

## Key Decisions & Staging for Next Steps

* Concept brief finalized and agreed upon across all architectural, operational, and constraint dimensions.
* Ready to proceed to `/egm-draft` to initialize the formal technical design document.
