/**
 * test_import_reference.js
 * Verifies that excel_engine.js correctly parses calendar_2027_reference.csv.
 */

import fs from 'fs';
import { parseSpreadsheet } from '../src/excel_engine.js';
import { DEFAULT_2027_ROSTER } from '../src/domain_data.js';

const csvContent = fs.readFileSync('calendar_2027_reference.csv', 'utf8');
const { parsedShifts, rawNames } = parseSpreadsheet(null, csvContent, true);

console.log(`Parsed total date slots: ${parsedShifts.length}`);
console.log(`Unique raw names discovered:`, rawNames);

// Active roster names
const activeRosterNames = new Set(DEFAULT_2027_ROSTER.map(m => m.name));
const unmatched = rawNames.filter(n => !activeRosterNames.has(n));

console.log(`Unmatched aliases (triggering modal):`, unmatched);

// Verify expected historical names KEEBAUGH and RILEY are identified
const hasKeebaugh = unmatched.includes('KEEBAUGH');
const hasRiley = unmatched.includes('RILEY');

console.log(`Contains KEEBAUGH: ${hasKeebaugh}`);
console.log(`Contains RILEY: ${hasRiley}`);

if (hasKeebaugh && hasRiley && parsedShifts.length > 300) {
  console.log('[PASS] Reference CSV import fidelity verified!');
} else {
  console.error('[FAIL] Import verification failed!');
  process.exit(1);
}
