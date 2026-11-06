/**
 * storage_adapter.js
 * Unified document persistence adapter with in-memory undo/redo and JSON backup/restore.
 */

import { createInitialAppState } from './domain_data.js';

const STORAGE_KEY = 'psp_fire_marshal_schedule_v1';
const MAX_UNDO_STACK = 50;

export class StorageAdapter {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.state = this.loadState();
  }

  /**
   * Loads state from localStorage or initializes default.
   */
  loadState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (parseErr) {
            this._preserveUnreadable(raw);
            throw parseErr;
          }
          if (!parsed || parsed.version !== 1) this._preserveUnreadable(raw);
          if (parsed && parsed.version === 1) {
            // Prune invalid observed holidays (e.g. Independence Day Observed)
            if (Array.isArray(parsed.holidays)) {
              parsed.holidays = parsed.holidays.filter(h => h.name !== 'Independence Day (Observed)' && !(h.date === '2027-07-05' && h.name.includes('Independence Day')));
            }
            // Synchronize full-year and half-year blocks
            if (parsed.cycles) {
              const years = new Set(Object.values(parsed.cycles).map(c => c.year).filter(Boolean));
              years.forEach(y => {
                const full = parsed.cycles[`${y}-FULL`];
                const h1 = parsed.cycles[`${y}-H1`];
                const h2 = parsed.cycles[`${y}-H2`];
                if (full) {
                  if (!full.assignments) full.assignments = {};
                  if (h1 && h1.assignments) {
                    for (const [d, id] of Object.entries(h1.assignments)) {
                      if (!full.assignments[d]) full.assignments[d] = id;
                    }
                  }
                  if (h2 && h2.assignments) {
                    for (const [d, id] of Object.entries(h2.assignments)) {
                      if (!full.assignments[d]) full.assignments[d] = id;
                    }
                  }
                }
              });
            }
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using initial state:', e);
    }
    return createInitialAppState();
  }

  /**
   * Keeps a copy of saved data we cannot read (corrupt or unknown version) so that
   * starting from defaults never silently destroys the user's schedule.
   */
  _preserveUnreadable(raw) {
    try {
      window.localStorage.setItem(STORAGE_KEY + '_unreadable_backup', raw);
    } catch (e) {
      console.warn('Could not preserve unreadable saved state:', e);
    }
  }

  /**
   * Persists state atomically to storage.
   */
  saveState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  /**
   * Pushes current state onto undo stack before a mutation.
   */
  pushUndo(cycleId = this.state.activeCycleId) {
    if (this.state.cycles[cycleId]) {
      this.undoStack.push(this._capture(cycleId));
      if (this.undoStack.length > MAX_UNDO_STACK) {
        this.undoStack.shift();
      }
      this.redoStack = []; // Clear redo stack on new action
    }
  }

  /**
   * Captures the current assignments of a cycle for the undo/redo stacks.
   */
  _capture(cycleId) {
    const c = this.state.cycles[cycleId];
    return {
      cycleId,
      assignments: { ...c.assignments },
      manualOverrides: { ...c.manualOverrides }
    };
  }

  _apply(entry) {
    const c = this.state.cycles[entry.cycleId];
    if (!c) return false;
    c.assignments = { ...entry.assignments };
    c.manualOverrides = { ...entry.manualOverrides };
    c.updatedAt = Date.now();
    this.state.activeCycleId = entry.cycleId; // show the cycle that changed
    this.saveState();
    return true;
  }

  /**
   * Performs undo on the cycle the entry was recorded for.
   */
  undo() {
    while (this.undoStack.length) {
      const previous = this.undoStack.pop();
      if (!this.state.cycles[previous.cycleId]) continue; // cycle removed
      this.redoStack.push(this._capture(previous.cycleId));
      return this._apply(previous);
    }
    return false;
  }

  /**
   * Performs redo on the cycle the entry was recorded for.
   */
  redo() {
    while (this.redoStack.length) {
      const next = this.redoStack.pop();
      if (!this.state.cycles[next.cycleId]) continue;
      this.undoStack.push(this._capture(next.cycleId));
      return this._apply(next);
    }
    return false;
  }

  /**
   * Saves a user-named snapshot.
   */
  createNamedSnapshot(label) {
    const activeCycle = this.state.cycles[this.state.activeCycleId];
    if (!activeCycle) return null;

    const id = `snap_${Date.now()}`;
    const snapshot = {
      id,
      scheduleId: this.state.activeCycleId,
      label,
      timestamp: Date.now(),
      payload: JSON.parse(JSON.stringify(activeCycle))
    };

    if (!this.state.savedSnapshots) this.state.savedSnapshots = {};
    this.state.savedSnapshots[id] = snapshot;
    this.saveState();
    return snapshot;
  }

  /**
   * Restores a named snapshot.
   */
  restoreNamedSnapshot(id) {
    const snap = this.state.savedSnapshots ? this.state.savedSnapshots[id] : null;
    if (!snap) return false;

    this.pushUndo(snap.scheduleId);
    this.state.cycles[snap.scheduleId] = JSON.parse(JSON.stringify(snap.payload));
    this.state.activeCycleId = snap.scheduleId;
    this.saveState();
    return true;
  }

  /**
   * Exports full AppState as JSON string.
   */
  exportBackupJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Imports and restores full AppState from JSON string.
   */
  importBackupJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.version === 1 && parsed.roster && parsed.cycles) {
        if (Array.isArray(parsed.holidays)) {
          parsed.holidays = parsed.holidays.filter(h => h.name !== 'Independence Day (Observed)' && !(h.date === '2027-07-05' && h.name.includes('Independence Day')));
        }
        this.state = parsed;
        this.undoStack = [];
        this.redoStack = [];
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('Invalid backup JSON:', e);
    }
    return false;
  }
}
