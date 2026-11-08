# Pennsylvania State Police: Troop H Fire Marshal Unit
## Operational User Guide & Practical Task Manual

This guide provides practical instructions for generating, managing, balancing, and printing on-call schedules for the Troop H Fire Marshal Unit.

---

### 1. Generating a Contract-Compliant Schedule

To build a schedule that adheres to collective bargaining and department rest rules:

1. **Verify Roster**: Click **Roster** to confirm active Full-Time (FT) and Alternate (ALT) investigators. Confirm weekend quotas for alternates (default: 3 weekends per 6 months).
2. **Record Approved Leave**: Click **Blackouts** and log all pre-approved vacations, training blocks, and military leave before generating. The scheduler will never assign shifts during approved leave.
3. **Log Weekend Preferences**: Click **Requests** if investigators submitted specific weekend requests. The engine prioritizes these requests while enforcing safety rules.
4. **Select Cycle & Run Generator**:
   - Choose **2027 H1** or **2027 H2** from the cycle selector.
   - Click **Auto-Generate Schedule**.
   - The engine produces a 100% staffed schedule in under 10 milliseconds with zero rest violations, balanced holidays, and exact alternate quotas.

---

### 2. Multi-Period & Full-Year Scheduling

The application coordinates H1, H2, and Full-Year schedules together:

- **First Half (H1: Jan 1 to Jun 30)**: Generate first or configure manually.
- **Second Half (H2: Jul 1 to Dec 31)**: When generated, H2 inspects H1 history to balance total annual weekends and holidays across all full-time members. It also protects rest continuity across the June/July boundary.
- **Full Year (FULL: Jan 1 to Dec 31)**:
  - Displays all 12 months in one view.
  - **Preservation Lock**: Clicking **Auto-Generate Schedule** while in FULL year will **never overwrite** shifts already scheduled in H1 or H2. It only fills remaining unassigned dates, protecting your manual edits and prior work.

---

### 3. What the Dots on the Calendar Mean

Small color-coded dots in the upper-right corner of calendar cells provide instant feedback on contract compliance:

| Indicator | Classification | Rule Definition and Triggers | Recommended Operational Action |
|:---:|:---:|:---|:---|
| Red Dot | Error / Hard Conflict | **Contractual or Safety Breach**:<br>1. **Post-Weekend Rest**: Investigator worked the prior weekend and was scheduled during mandatory recovery days (Thursday to Sunday, or Wednesday).<br>2. **Blackout Clash**: Member scheduled during approved leave.<br>3. **Tenure Boundary**: Assigned before hire date or after departure date.<br>4. **Alternate Weekday**: Alternate assigned routine Mon-Thu weekday shifts without exemption. | Click the day cell and select an eligible investigator to resolve the violation. |
| Amber Dot | Warning / Soft Breach | **Operational Warning**:<br>1. **Consecutive Weekends**: Same investigator assigned back-to-back weekends.<br>2. **Quota Exceeded**: Alternate exceeds their 6-month weekend limit.<br>3. **Unassigned Day**: Date has no on-call coverage. | Reassign one of the weekends to another investigator, or assign coverage to the open date. |
| Blue Dot | Workload Concentration | **Weekday Clustering**:<br>1. Full-Time investigator assigned to 2 or more weekday shifts (Mon-Thu) in the same work week. | Check if one of the weekday shifts can be swapped with another team member to balance the weekly load. |

---

### 4. Manually Assigning or Adjusting Shifts

1. **Click any date cell** on the calendar.
2. The assignment dialog opens with the investigator dropdown **focused automatically**.
3. **Quick Selection**: Type the first letter of an investigator name or use the arrow keys, then press **Enter** to save (or press **Escape** to cancel).
4. **Rest Violation Guard**: If you assign an investigator who worked the preceding weekend to Thursday through Sunday (their mandatory rest days), a warning prompt appears asking for explicit confirmation to overwrite.
5. **Clear Shift**: Click *Clear Shift* inside the dialog to leave that specific date unassigned.

---

### 5. Clearing Shifts (Current Month vs Entire Cycle)

- Click **Clear Calendar** in the top navigation bar.
- Choose your target scope:
  - **Current Month Only**: Clears only the active month displayed on screen.
  - **Entire Calendar Year / Block**: Clears all assignments across the selected cycle (H1, H2, or FULL).
- Confirm the clear action in the prompt.
- **Undo / Redo**: Made an accidental change? Press **Ctrl+Z** (or click Undo) to instantly recover your assignments.

---

### 6. Printing and Exporting

- **Print Month**: Click **Print** to output the current month formatted for standard landscape 8.5" x 11" paper. Troop H headers appear centered at the top; navigation bars and browser timestamps are omitted.
- **Print All Months**: Click **Print All** to print every month of the cycle sequentially with clean page breaks.
- **Print Matrix**: Switch to the **Matrix** tab and click **Print**. Only **Weekend #**, **Weekend Dates**, and **Assigned Personnel** will print.
- **Export to Excel**: Click **Export Excel** on the far right of the menu bar to generate an official formatted spreadsheet.
- **Backup & Restore**: Click **Backup** to download a single JSON file containing all rosters, blackouts, requests, and schedules. Use **Restore** to reload your setup on another computer or roll back to a known snapshot.
