# Pennsylvania State Police: Troop H Fire Marshal Unit
## Scheduling Rules, Contractual Constraints, and Invariant Specification

This document details all contractual rules, operational constraints, and algorithmic invariants implemented within the PSP Fire Marshal On-Call Schedule Generator.

---

## 1. Unit Structure and Roles

### Full-Time (FT) Fire Marshals
- Core Personnel: Primary investigators responsible for overall operational readiness and emergency fire investigations across the Troop H coverage area.
- Assignment Scope: Full-time members are eligible for on-call duty on all calendar days: regular weekdays (Monday through Thursday night shifts), standard weekends, and official state holidays.
- Roster Defaults: Wolfe, Polcha, Terek, Kemerer.

### Alternate (ALT) Fire Marshals
- Relief Personnel: Auxiliary investigators who provide relief coverage to prevent fatigue among full-time investigators.
- Assignment Scope:
  - Weekend-Only Restriction: Alternates may only be assigned to Friday-Sunday weekend duty and attached Monday holidays (such as Labor Day or Memorial Day) when covering that weekend.
  - No Mon-Thu Weekday Duty: Alternates are strictly barred from working routine Monday through Thursday weekday night shifts unless granted an administrative exemption.
- Quota per 6-Month Block:
  - Standard quota: 3 weekends per 6-month block (H1: Jan-Jun, H2: Jul-Dec), totaling 6 weekends per full calendar year.
  - Quotas are individually customizable in the Personnel Roster.
- Spacing / Dispersion Rule:
  - Alternate weekends are distributed evenly across each 6-month block (approximately once every 4 to 5 weeks).
  - Alternates must never be scheduled on back-to-back weekends or consecutive weeks.
- Roster Defaults: Chester, Zeiders, Reed.

### Tenure and Active Window
- Each investigator possesses an `activeStart` date and an optional `activeEnd` date.
- No shifts may be assigned to any member outside their active service window.
- Members retired or reassigned prior to a cycle start are automatically excluded from that cycle.

---

## 2. Shift and Weekend Definitions

- Weekday Shift: 15 hours of on-call duty covering 17:00 to 08:00 the following morning (Monday, Tuesday, Wednesday, and Thursday nights).
- Weekend Shift Block & 80-Hour Cap: 63 consecutive hours from Friday at 17:00 through Monday at 08:00.
  - A weekend is staffed as an atomic block: the same investigator covers Friday night, Saturday, and Sunday.
  - Troopers are strictly capped at 80 hours in a 2-week period. Someone working the weekend works Monday through the following Wednesday (10 consecutive days, which is 80 hours). If the Trooper has an attached holiday to cover on the Thursday, Friday, or Monday surrounding a weekend, their schedule remains within their mandatory 80-hour limit.

---

## 3. Post-Weekend Rest and Days Off (Crucial Invariant)

To guarantee Trooper recovery following weekend duty, mandatory rest days are enforced. In a two-week period, a Trooper working the weekend works 80 hours Monday through the following Wednesday, with Thursday through Sunday off as mandatory rest days. During a normal (non on-call) cycle, Troopers work standard Monday through Friday with Saturday and Sunday off:

1. Mandatory Days Off (Thursday through Sunday):
   - Any Trooper who works a weekend is strictly off duty on the immediately following Thursday, Friday, Saturday, and Sunday.
   - Under no circumstances will the automatic solver schedule a Trooper on these four recovery days.
2. Wednesday Recovery Protection:
   - The Wednesday immediately following a weekend shift is designated as a compensatory rest day; the weekend worker cannot be assigned Wednesday on-call duty.
3. Manual Override Warning:
   - If a supervisor attempts to manually assign a Trooper to Thursday, Friday, Saturday, or Sunday following their weekend duty, the system immediately flags the rule violation and requires an explicit confirmation prompt to overwrite.

---

## 4. Week-Shaping Before Weekend Duty

To prevent pre-weekend fatigue for full-time investigators:

- Tuesday: Assigned to another investigator.
- Wednesday: Assigned to the upcoming weekend worker (pre-weekend alignment).
- Thursday: Assigned to a different investigator (the upcoming weekend worker is given Thursday night off so they are fully rested for Friday 17:00 duty).

---

## 5. Consecutive Weekend Invariant

- Zero Consecutive Weekends: Under no condition may any investigator (FT or ALT) work two consecutive calendar weekends.
- Cross-Cycle Continuity: This rule is strictly enforced across the June 30 / July 1 boundary between H1 and H2. The member working the final weekend of June (such as June 25-27) cannot work the first weekend of July (July 2-4).

---

## 6. Proactive Lookahead Alternate Coverage

- When a full-time investigator has an approved blackout or leave starting on a Monday:
  - An Alternate investigator is proactively scheduled for the preceding weekend.
  - This prevents the departing full-time investigator from working a grueling weekend shift immediately prior to their scheduled leave.

---

## 7. Official State Holidays

The schedule recognizes 11 Official Pennsylvania State Holidays:
1. New Year's Day (January 1)
2. Martin Luther King Jr. Day (3rd Monday in January)
3. Presidents' Day (3rd Monday in February)
4. Good Friday (Friday before Easter)
5. Memorial Day (Last Monday in May)
6. Juneteenth National Independence Day (June 19)
7. Independence Day (July 4: celebrated strictly on July 4th, never shifted)
8. Labor Day (1st Monday in September)
9. Columbus Day (2nd Monday in October)
10. Veterans Day (November 11)
11. Thanksgiving Day (4th Thursday in November)
12. Christmas Day (December 25)

### Attached vs Standalone Holidays
- Attached Holidays: A holiday falling on a Friday or Monday is attached to the adjacent weekend and is covered by the investigator working that weekend.
- Standalone Holidays: Mid-week holidays (such as Thanksgiving Thursday or midweek July 4th) are distributed equitably among Full-Time investigators as the final stage of scheduling.

---

## 8. Blackouts vs Requested Weekends Precedence

1. Blackouts (Approved Leave):
   - Absolute highest priority hard constraint.
   - The solver will never assign an investigator to any date covered by an approved blackout.
2. Requested Weekends:
   - Honored in Stage 1 of schedule generation.
   - Honored on a first-come basis, provided the request does not conflict with an approved blackout or cause a consecutive-weekend violation.
   - Alternate requests are capped at their assigned block quota (default: 3).

---

## 9. Full-Year Synchronization and Cross-Half Balancing

1. Full-Year (`FULL`) Autogenerate Preservation:
   - When Autogenerate Schedule is executed on the FULL year view, shifts previously scheduled in H1 or H2 are automatically locked and preserved.
   - The solver fills only unassigned days, preventing accidental overwrites.
2. H2 Balancing Against H1:
   - When generating H2 (July through December), the solver analyzes H1 assignments.
   - Total weekends, holidays, and weekday loads are calculated across both halves to ensure annual workload parity.
