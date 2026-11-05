# Pennsylvania State Police Fire Marshal On-Call Scheduler
## Administrator Operational User Guide

This user guide provides operational instructions for barracks administrators managing 24/7 on-call duty scheduling for Pennsylvania State Police (PSP) Fire Marshals and Alternates.

---

## Quick Start & Offline Portability

The entire scheduler is packaged into a single standalone file: `index.html`.
* **Zero Installation:** Requires no server, no internet access, and no administrative installation privileges.
* **Launch:** Double-click `index.html` on your workstation or USB drive. It opens immediately in Microsoft Edge or Google Chrome.
* **Storage & Privacy:** All rosters, time-off requests, and schedule assignments are saved automatically to your local browser storage (`localStorage`). No data ever leaves your computer.

---

## Chapter 1: Initial Setup & Roster Management (CUJ 1)

### Selecting the Scheduling Horizon
Use the cycle dropdown in the top-right header to select your planning period:
* **2027 H1:** January 1 through June 30, 2027 (standard 6-month block).
* **2027 H2:** July 1 through December 31, 2027.
* **2027 FULL:** Full calendar year (January 1 through December 31, 2027).

### Managing the Personnel Roster
Click the **👥 Roster** button in the ribbon to open the Roster Drawer:
* **View Active Roster:** Displays all active investigators, their classification (Full-Time vs. Alternate), tenure boundaries, and custom color tags.
* **Adding a Member:** Click `+ Add Member`, enter the investigator's uppercase surname (e.g., `SMITH`), and designate them as **Full-Time (FT)** or **Alternate (ALT)**.
* **Tenure Limits (Transfers & Retirements):** Full-time members with mid-cycle transfers (such as Kemerer departing February 28, 2027) have active start and end dates. The scheduler automatically stops assigning shifts after their departure date.
* **Cycle Isolation:** Past schedules and archived 6-month cycles retain their own roster snapshot. Adding, transferring, or retiring members in future cycles will never alter historical duty rosters.

---

## Chapter 2: Booking Vacations & Auto-Solving (CUJ 2)

### Booking Vacation & Blackout Ranges
Click the **📅 Blackouts** button in the ribbon:
1. Select the investigator from the dropdown.
2. Select the **Start Date** and **End Date** using the date pickers.
3. Add a brief reason note (e.g., *Summer Vacation*, *Hunting Leave*, *Military Duty*).
4. Click **Book Blackout Range**. The requested dates immediately lock in the system.

### Running the Auto-Scheduler
Click the **⚙️ Auto-Generate Schedule** button in the top navigation bar. In under 50 milliseconds, the 5-Stage CSP solver constructs a complete conflict-free schedule enforcing:
1. **Daily 24/7 Coverage:** Every calendar day has exactly one investigator on call.
2. **4-Day Post-Weekend Compensatory Rest:** When a Full-Time member works a weekend shift, their following departmental days off (RDO) Thursday through Sunday legally block them from Wednesday through Friday on-call duty.
3. **Phase 2 Weekend Expansion:** In Phase 2 (March–December), FT weekend duty covers Friday through Monday (4 days).
4. **Proactive Lookahead Alternate Placement:** When an FT member takes approved leave, the solver automatically places an Alternate on the preceding weekend so the remaining two FT members enter the week fully rested.
5. **Exact Alternate Quotas:** Alternates are assigned exactly 3 weekends per 6-month half (6 per full year).
6. **No Consecutive Weekends:** No investigator is scheduled for back-to-back weekends.

---

## Chapter 3: Spreadsheet Ingestion & Name Resolution (CUJ 3)

The scheduler accepts existing spreadsheets exported from Microsoft Excel or Google Sheets.

### Supported File Formats
1. **7-Column Barracks Calendar:** The standard monthly grid layout matching traditional bulletin board postings (with dates, member names, and footnote notes).
2. **2-Column Tabular Date List:** A simple spreadsheet containing `Date` and `Member Name` columns.

### Importing a Schedule
1. Click the **📄 Import** button in the ribbon.
2. Drag and drop your `.xlsx` or `.csv` file into the dashed drop zone (or click *Browse Files*).
3. The importer parses all daily assignments automatically.

### Reconciling Unmatched Names
If the spreadsheet contains historical names, retired personnel (`KEEBAUGH`), transfer troopers (`RILEY`), or spelling variants, the **Reconcile Unmatched Personnel Names** modal opens:
* **Map to Existing Member:** Select an active roster member from the clean dropdown.
* **Create Historical Record:** Select *+ Create as Historical Inactive Member* to preserve the historical record without adding them to active future duty.
* **Leave Blank:** Select *Leave Unassigned* to review the shift manually.
Click **Apply Reconciled Schedule** to load the assignments into the calendar.

---

## Chapter 4: Manual Adjustments & Conflict Diagnostics (CUJ 4)

### Manual Shift Overrides
To change any shift assignment:
1. Click on the target day cell in the 7-column calendar.
2. The **Reassign Shift** modal opens. Select the desired investigator or click *Clear Shift*.
3. Click **Save Assignment**.

### Undo / Redo
Accidental overrides can be instantly reversed using the **↺ Undo** (`Ctrl+Z`) and **↻ Redo** (`Ctrl+Y`) buttons in the top header. The system maintains an in-memory history of up to 50 edits.

### Visual Conflict Indicators
The calendar displays live diagnostic badges to protect against contractual violations:
* **🔴 Red Dot (Rest Violation):** An FT member is placed on Wednesday, Thursday, or Friday immediately following weekend duty.
* **🔴 Red Dot (Blackout Clash):** An investigator is scheduled on an approved vacation date.
* **🔴 Red Dot (Alternate Weekday Violation):** An Alternate is placed on a Monday–Thursday shift outside attached Monday holidays.
* **🔴 Red Dot (Tenure Violation):** A member is assigned outside their active service dates.
* **🟠 Orange Dot (Warning):** An Alternate exceeds their 3-weekend quota or a member is assigned consecutive weekends.
* **🟡 Blue/Amber Dot (Attention):** A Full-Time member is covering two or more mid-week shifts during a constrained week.
* **Administrative Exemption Footnote:** When an Alternate is manually forced into a weekday shift, the calendar automatically appends an official footnote to the schedule: `* Administrative Exemption: Manual Alternate Weekday Assignment`.

---

## Chapter 5: Excel Export & Barracks Printing (CUJ 5)

### Exporting to Microsoft Excel
Click the **📥 Export to Excel** button in the ribbon:
* Generates a professionally styled `.xlsx` workbook formatted identically to the operational barracks standard.
* Includes 7-column monthly blocks, date headers, centered uppercase names, and merged operational footnote notes (`On call starts PM that day after scheduled shift into next morning 0600hrs`).
* File name automatically formats as: `[Year]_[Block]_Fire_Marshal_OnCall_Schedule.xlsx`.

### Printing for Barracks Bulletin Board Posting
Click the **🖨️ Print** button (or press `Ctrl+P` in your browser):
* Dedicated print styling automatically hides all web navigation, buttons, and drawer overlays.
* Formats each month cleanly onto a single physical landscape page matching official command posting requirements.

---

## Verification & Automated Testing

To run the automated algorithmic verification test suite:
* **In Browser:** Double-click and open `tests/solver_test.html`. It verifies all 7 mathematical domain invariants and displays `ALL TESTS PASSED`.
* **In Terminal:** Run `node tests/solver_test.js`.
