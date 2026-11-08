# Pennsylvania State Police: Troop H Fire Marshal Unit
## On-Call Calendar User Guide and Feature Manual

Welcome to the Troop H Fire Marshal On-Call Schedule Generator. This guide explains every feature, button, visual indicator, and workflow available in the application.

---

## 1. Interface Overview

The application is structured into four main operational areas:
1. Top Header: Cycle selection, block management, undo/redo, automatic generation, and clearing.
2. Action Ribbon (Single-Line Menu): Quick access to personnel, blackouts, weekend requests, import/export, printing, and reference documentation.
3. View Tabs and Month Navigation: Switch between 7-Column Calendar, Matrix Overview, and Shift Breakdown views, with month tabs and a continuous Show All Months scrolling option.
4. Interactive Calendar Grid: The main schedule workspace where shifts, holidays, and conflict indicators are displayed and editable.

---

## 2. What the Dots on the Calendar Mean

Each day cell in the calendar can display small circular status dots in the upper-right corner. These provide instant visual feedback on rule compliance:

| Dot Indicator | Classification | Rule Definition and Triggers |
|:---:|:---:|:---|
| Red Dot | Error / Hard Conflict | Contractual or Safety Violation:<br>1. Blackout Clash: Member is scheduled on an approved leave day.<br>2. Tenure Boundary: Member is assigned before start date or after departure date.<br>3. Post-Weekend Rest: An investigator who worked the prior weekend was scheduled during mandatory recovery days (Thursday-Sunday, or Wednesday).<br>4. Alternate Weekday: An Alternate was assigned to routine Mon-Thu weekday shifts without administrative exemption. |
| Amber Dot | Warning / Soft Breach | Operational Warning:<br>1. Consecutive Weekend: Member is assigned to back-to-back weekends.<br>2. Alternate Quota Exceeded: Alternate exceeds their 6-month weekend limit (default: 3).<br>3. Unassigned Day: A day has no investigator assigned. |
| Blue Dot | Attention / Multi-Shift | Workload Concentration:<br>A Full-Time investigator is assigned to 2 or more weekday shifts within the same Monday-Thursday work week. |

---

## 3. Calendar Day Elements

- Day Number: Calendar date. Greyed out if outside the active month.
- Holiday Pill:
  - Red Pill (Premium): Major holidays (such as Thanksgiving, Christmas, New Year's Day, Memorial Day, Labor Day, July 4th).
  - Blue Pill (Standard): Official state holidays (such as Presidents' Day, MLK Day, Columbus Day, Veterans Day, Juneteenth).
  - Note: July 4th is celebrated strictly on July 4th and never shifted to an observed weekday.
- Shift Assignment Chip:
  - Displays the investigator last name and role (FT for Full-Time, ALT for Alternate).
  - Background color matches the member assigned color badge.
  - Days with no coverage display a grey UNASSIGNED chip.

---

## 4. Top Header Controls

- Cycle Selector: Choose between:
  - 2027 H1: January 1 to June 30 (181 days).
  - 2027 H2: July 1 to December 31 (184 days).
  - 2027 FULL: Entire calendar year (365 days).
- Add Year / Block: Create a new annual schedule block or multi-month cycle.
- Undo (Ctrl+Z) and Redo (Ctrl+Y): Step backward or forward through schedule edits, generation runs, or clears.
- Auto-Generate Schedule:
  - Runs the 5-Stage Stratified Constraint Satisfaction Problem (CSP) solver.
  - Automatically respects blackouts, requests, rest days, alternate quotas, and holiday fairness.
  - When run on FULL Year, it locks and preserves existing H1 and H2 shifts and only fills unassigned days.
  - When run on H2, it looks back at H1 to balance annual workloads and prevent boundary rest violations.
- Clear Calendar:
  - Displays a modal asking whether to clear:
    1. Current Month Only: Clears only the active month.
    2. Entire Selected Calendar: Wipes all assignments for the active cycle.
  - Requires explicit confirmation and is fully undoable with Ctrl+Z.

---

## 5. Action Ribbon (Single-Line Menu)

- Personnel Roster: Add, edit, or remove investigators. Configure Full-Time vs Alternate roles, active date ranges, and custom Alternate weekend quotas.
- Blackouts and Leave: Record approved vacations, military duty, training, or medical leave.
- Requested Weekends: Record investigator preferred weekend duty. The dropdown displays current scheduled and requested counts for each investigator.
- Import Schedule: Import schedules from CSV files. If historical files contain former staff names (such as Keebaugh or Riley), an Alias Mapping modal automatically prompts to link or substitute them.
- Export to Excel: Download the active schedule as a professionally formatted spreadsheet.
- Export Backup (JSON): Save the entire system state (roster, blackouts, requests, and all cycles) as a single JSON file.
- Restore Backup: Restore complete system state from a previously saved JSON file.
- Print: Print the current month view.
- Print All Months: Print all months in the active cycle sequentially, with clean page breaks between months.
- How to Use: Opens this interactive guide.
- Schedule Rules: Opens the comprehensive schedule rules and constraints document.

---

## 6. How to Edit Shifts Manually

1. Click on any calendar day.
2. The Duty Assignment Modal appears.
3. The investigator dropdown autofocuses immediately:
   - Press the first letter of a name (or use Up/Down arrow keys) to select an investigator.
   - Live validation checks for blackout conflicts, post-weekend rest violations, or role restrictions.
4. Press Enter to save the assignment (or press Escape to cancel).
5. Rule Violation Warning: If assigning someone who worked the prior weekend to Thursday-Sunday, or violating an approved blackout, a warning prompt appears requiring explicit confirmation to overwrite.
6. Click Clear Shift to leave the day unassigned.

---

## 7. Printing the Schedule

- Click Print (current month) or Print All (entire cycle).
- The print output automatically formats for clean 8.5 x 11 paper:
  - Header displays: Troop H Fire Marshal Unit Schedule centered at the top of each page.
  - Navigation bars, buttons, browser timestamps, and web headers are automatically suppressed.
