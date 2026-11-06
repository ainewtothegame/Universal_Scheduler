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
          const parsed = JSON.parse(raw);
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
  pushUndo() {
    // Deep copy current active cycle assignments
    const activeCycle = this.state.cycles[this.state.activeCycleId];
    if (activeCycle) {
      this.undoStack.push({
        cycleId: this.state.activeCycleId,
        assignments: { ...activeCycle.assignments },
        manualOverrides: { ...activeCycle.manualOverrides }
      });
      if (this.undoStack.length > MAX_UNDO_STACK) {
        this.undoStack.shift();
      }
      this.redoStack = []; // Clear redo stack on new action
    }
  }

  /**
   * Performs undo.
   */
  undo() {
    if (this.undoStack.length === 0) return false;
    const activeCycle = this.state.cycles[this.state.activeCycleId];
    if (!activeCycle) return false;

    // Push current to redo
    this.redoStack.push({
      cycleId: this.state.activeCycleId,
      assignments: { ...activeCycle.assignments },
      manualOverrides: { ...activeCycle.manualOverrides }
    });

    const previous = this.undoStack.pop();
    activeCycle.assignments = { ...previous.assignments };
    activeCycle.manualOverrides = { ...previous.manualOverrides };
    activeCycle.updatedAt = Date.now();
    this.saveState();
    return true;
  }

  /**
   * Performs redo.
   */
  redo() {
    if (this.redoStack.length === 0) return false;
    const activeCycle = this.state.cycles[this.state.activeCycleId];
    if (!activeCycle) return false;

    this.undoStack.push({
      cycleId: this.state.activeCycleId,
      assignments: { ...activeCycle.assignments },
      manualOverrides: { ...activeCycle.manualOverrides }
    });

    const next = this.redoStack.pop();
    activeCycle.assignments = { ...next.assignments };
    activeCycle.manualOverrides = { ...next.manualOverrides };
    activeCycle.updatedAt = Date.now();
    this.saveState();
    return true;
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

    this.pushUndo();
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
