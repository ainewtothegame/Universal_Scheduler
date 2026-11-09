/**
 * build_single_file.js
 * Inlines all styles, scripts, SheetJS, and domain logic into a 100% self-contained index.html.
 * Zero external file dependencies - only index.html is needed!
 */

import fs from 'fs';

console.log('Building 100% self-contained index.html (zero external dependencies)...');

const sheetJsCode = fs.readFileSync('xlsx.full.min.js', 'utf8');

function cleanModuleCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  // Strip import statements
  code = code.replace(/^import\s[^;]*?from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '');
  // Replace export function / export const / export class / export let
  code = code.replace(/export\s+function\s+/g, 'function ');
  code = code.replace(/export\s+const\s+/g, 'const ');
  code = code.replace(/export\s+let\s+/g, 'let ');
  code = code.replace(/export\s+class\s+/g, 'class ');
  return code;
}

const domainDataCode = cleanModuleCode('src/domain_data.js');
const cspSolverCode = cleanModuleCode('src/csp_solver.js');
const conflictEngineCode = cleanModuleCode('src/conflict_engine.js');
const excelEngineCode = cleanModuleCode('src/excel_engine.js');
const storageAdapterCode = cleanModuleCode('src/storage_adapter.js');

const scheduleRulesMd = fs.readFileSync('SCHEDULE_RULES.md', 'utf8');
const userGuideMd = fs.readFileSync('USER_GUIDE.md', 'utf8');

function formatInline(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/–/g, ' to ')
    .replace(/—/g, ': ')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--color-ink); font-weight:600;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-paper-2); padding:2px 6px; border-radius:4px; font-size:11px; border:1px solid var(--color-rule); font-family:monospace;">$1</code>');
}

function markdownToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let inTable = false;
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line === '---') {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table></div>'; inTable = false; }
      if (line === '---') html += '<hr style="border:0; border-top:1px solid var(--color-rule); margin:16px 0;">';
      continue;
    }
    // Headers
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table></div>'; inTable = false; }
      html += '<h2 style="font-family:var(--font-display); font-size:20px; font-weight:600; color:var(--color-ink); margin:18px 0 8px 0; border-bottom:1px solid var(--color-rule); padding-bottom:6px;">' + formatInline(line.slice(2)) + '</h2>';
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table></div>'; inTable = false; }
      html += '<h3 style="font-family:var(--font-display); font-size:16px; font-weight:600; color:var(--color-accent); margin:16px 0 6px 0;">' + formatInline(line.slice(3)) + '</h3>';
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inTable) { html += '</tbody></table></div>'; inTable = false; }
      html += '<h4 style="font-family:var(--font-display); font-size:14px; font-weight:600; color:var(--color-ink); margin:12px 0 4px 0;">' + formatInline(line.slice(4)) + '</h4>';
      continue;
    }
    // Table rows
    if (line.startsWith('|')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inTable) {
        inTable = true;
        html += '<div style="overflow-x:auto; margin:12px 0;"><table class="matrix-table" style="width:100%; font-size:12px; border-collapse:collapse;">';
      }
      if (line.includes('---')) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!html.includes('<tbody>')) {
        html += '<thead><tr>' + cells.map(c => '<th style="background:var(--color-paper-2); padding:8px 10px; border:1px solid var(--color-rule); font-weight:600; text-align:left;">' + formatInline(c) + '</th>').join('') + '</tr></thead><tbody>';
      } else {
        html += '<tr>' + cells.map(c => '<td style="padding:7px 10px; border:1px solid var(--color-rule); vertical-align:top;">' + formatInline(c) + '</td>').join('') + '</tr>';
      }
      continue;
    } else if (inTable) {
      html += '</tbody></table></div>';
      inTable = false;
    }
    // Bullet Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { html += '<ul style="margin:6px 0 10px 20px; line-height:1.55;">'; inList = true; }
      html += '<li style="margin-bottom:4px; font-size:13px; color:var(--color-ink-2);">' + formatInline(line.slice(2)) + '</li>';
      continue;
    }
    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<div style="margin:6px 0; font-size:13px; line-height:1.55; color:var(--color-ink-2);"><strong style="color:var(--color-ink);">' + numMatch[1] + '.</strong> ' + formatInline(numMatch[2]) + '</div>';
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    // Paragraph
    html += '<p style="margin:6px 0 10px 0; font-size:13px; line-height:1.55; color:var(--color-ink-2);">' + formatInline(line) + '</p>';
  }
  if (inList) html += '</ul>';
  if (inTable) html += '</tbody></table></div>';
  return html;
}

const scheduleRulesHtml = markdownToHtml(scheduleRulesMd);
const userGuideHtml = markdownToHtml(userGuideMd);


// HTML shell
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Pennsylvania State Police Troop H Fire Marshal on-call schedule generator, fatigue risk management, and duty assignment planner.">
  <title>PSP Fire Marshal On-Call Schedule Generator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600&family=Funnel+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
/* Hallmark · shape: Workbench · genre: atmospheric · theme: Refract (by request) · job: try · draw: 7f3a2c
 * hero: Stage · nav: edge-aligned · footer: mast · imagery: none · signature: caustics light band · refract: water/pool
 * axes: light/grotesk-sans/cool · posture: restrained · contrast: pass · fold: pass · v2.0.0 */
/* Hallmark · pre-emit critique: P9 H9 E9 S9 R9 V9 · weakest: none, refined all panels and ribbons */
    :root {
      color-scheme: light;
      --color-paper: oklch(98.2% 0.006 95);
      --color-paper-2: oklch(96.4% 0.006 95);
      --color-paper-3: oklch(93.6% 0.008 95);
      --color-ink: oklch(23% 0.035 245);
      --color-ink-2: oklch(36% 0.035 245);
      --color-muted: oklch(50% 0.025 240);
      --color-rule: oklch(89.5% 0.008 230);
      --color-rule-2: oklch(93.5% 0.006 230);
      --color-accent: oklch(50% 0.12 234);
      --color-accent-hi: oklch(44% 0.12 236);
      --color-accent-ink: oklch(99% 0.003 95);
      --color-accent-soft: oklch(94% 0.025 220);
      --color-focus: oklch(56% 0.14 234);
      --color-shade: oklch(86% 0.05 212);
      --color-shade-2: oklch(74% 0.07 220);
      --color-light: oklch(99.7% 0.004 95);
      --spec-1: oklch(78% 0.15 32);
      --spec-2: oklch(90% 0.15 105);
      --spec-3: oklch(82% 0.13 175);
      --spec-4: oklch(66% 0.15 270);
      --caustic-glow-1: oklch(50% 0.12 234 / 0.45);
      --caustic-glow-2: oklch(82% 0.13 175 / 0.2);
      --caustic-modal-1: oklch(50% 0.12 234 / 0.4);
      --caustic-modal-2: oklch(82% 0.13 175 / 0.15);
      --edge-light: inset 0 1px 0 oklch(100% 0 0 / 0.9), inset 0 0 0 1px oklch(100% 0 0 / 0.55);
      --shadow-card: 18px 28px 48px -26px oklch(52% 0.09 220 / 0.22), 2px 3px 6px -2px oklch(40% 0.05 230 / 0.08);
      --shadow-cast: 28px 40px 70px -30px oklch(60% 0.11 212 / 0.32);
      --shadow-btn-light: 0 1px 2px rgba(0,0,0,0.04);
      --shadow-btn-dark: 0 1px 2px rgba(0,0,0,0.02);
      --shadow-tab-active: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-chip: 0 1px 2px rgba(0,0,0,0.08);
      --shadow-subtle: 0 1px 3px rgba(0,0,0,0.05);
      --font-display: "Funnel Display", ui-sans-serif, system-ui, -apple-system, sans-serif;
      --font-body: "Funnel Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
      --radius-card: 20px;
      --radius-inner: 10px;
      --radius-pill: 999px;
      --rule-hair: 1px;
      --tracking-display: -0.032em;
      --display-weight: 500;

      /* Semantic Token Mappings */
      --primary: var(--color-ink);
      --primary-hover: var(--color-ink-2);
      --bg-main: var(--color-paper);
      --card-bg: var(--color-light);
      --border-color: var(--color-rule);
      --text-main: var(--color-ink);
      --text-muted: var(--color-muted);
      --danger: oklch(52% 0.22 25);
      --danger-hover: oklch(44% 0.22 25);
      --danger-soft: oklch(95% 0.04 25);
      --danger-border: oklch(75% 0.15 25);
      --danger-text: oklch(45% 0.2 25);
      --warning: oklch(68% 0.17 65);
      --warning-soft: oklch(96% 0.04 85);
      --warning-soft-border: oklch(88% 0.08 85);
      --warning-border: oklch(75% 0.14 75);
      --warning-text: oklch(40% 0.12 70);
      --success: oklch(52% 0.15 150);
      --success-hover: oklch(46% 0.15 150);
      --success-soft: oklch(96% 0.04 150);
      --success-border: oklch(88% 0.08 150);
      --success-text: oklch(38% 0.12 150);
      --info: var(--color-accent);
      --info-text: oklch(42% 0.12 234);
      --color-print-ink: #000000;
      --color-print-paper: #ffffff;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      overflow-x: clip;
    }

    ::selection {
      background: color-mix(in oklab, var(--color-accent) 22%, transparent);
      color: var(--color-ink);
    }

    body {
      font-family: var(--font-body);
      background: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.55;
      caret-color: var(--color-accent);
      -webkit-font-smoothing: antialiased;
    }

    :focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* Top Navigation Bar with Refract caustics sheen */
    header {
      background: var(--color-ink);
      background-image:
        radial-gradient(ellipse at 85% 0%, var(--caustic-glow-1) 0%, transparent 65%),
        radial-gradient(ellipse at 15% 100%, var(--caustic-glow-2) 0%, transparent 50%);
      color: var(--color-light);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-card);
      position: sticky;
      top: 0;
      z-index: 50;
      gap: 16px;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    header::-webkit-scrollbar { display: none; }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .brand-title {
      font-family: var(--font-display);
      font-size: 19px;
      font-weight: 600;
      letter-spacing: var(--tracking-display);
      overflow-wrap: break-word;
      min-width: 0;
    }

    .brand-badge {
      font-family: var(--font-body);
      font-size: 11px;
      background: color-mix(in oklab, var(--color-light) 15%, transparent);
      border: 1px solid color-mix(in oklab, var(--color-light) 25%, transparent);
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }

    .cycle-select {
      background: var(--color-light);
      color: var(--color-ink);
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
      white-space: nowrap;
    }

    .btn:active { transform: scale(0.98); }

    .btn-light {
      background: var(--color-light);
      color: var(--color-ink);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-btn-light);
    }
    .btn-light:hover {
      background: var(--color-paper-2);
      border-color: var(--color-rule-2);
    }

    .btn-primary {
      background: var(--color-accent);
      color: var(--color-accent-ink);
      box-shadow: var(--shadow-card);
    }
    .btn-primary:hover {
      background: var(--color-accent-hi);
    }

    .btn-success {
      background: var(--success);
      color: var(--color-light);
    }
    .btn-success:hover {
      background: var(--success-hover);
    }

    .btn-danger {
      background: var(--danger);
      color: var(--color-light);
      box-shadow: var(--shadow-card);
    }
    .btn-danger:hover {
      background: var(--danger-hover);
    }

    .btn-outline {
      background: transparent;
      border-color: color-mix(in oklab, var(--color-light) 30%, transparent);
      color: var(--color-light);
    }
    .btn-outline:hover {
      background: color-mix(in oklab, var(--color-light) 12%, transparent);
    }

    .btn-outline-dark {
      background: var(--color-light);
      border-color: var(--border-color);
      color: var(--color-ink);
      box-shadow: var(--shadow-btn-dark);
    }
    .btn-outline-dark:hover {
      background: var(--color-accent-soft);
      border-color: var(--color-accent);
    }

    /* Single-Line Action Ribbon */
    .ribbon {
      background: var(--color-light);
      border-bottom: 1px solid var(--border-color);
      padding: 6px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .ribbon::-webkit-scrollbar { display: none; }

    .tab-group {
      display: flex;
      background: var(--color-paper-2);
      padding: 3px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-color);
      gap: 2px;
      flex-shrink: 0;
    }

    .tab-btn {
      padding: 5px 12px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-weight: 500;
      font-size: 12px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      white-space: nowrap;
    }

    .tab-btn.active {
      background: var(--color-light);
      color: var(--color-ink);
      box-shadow: var(--shadow-tab-active);
    }

    .ribbon-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }

    .ribbon-actions .btn {
      padding: 5px 10px;
      font-size: 12px;
      gap: 4px;
      white-space: nowrap;
      line-height: 1.25;
      height: 30px;
    }

    .ribbon-divider {
      height: 18px;
      width: 1px;
      background: var(--border-color);
      margin: 0 3px;
      flex-shrink: 0;
    }

    /* Month Navigation Tabs */
    .month-tabs {
      background: var(--color-paper-2);
      border-bottom: 1px solid var(--border-color);
      padding: 0 16px;
      display: flex;
      align-items: center;
      overflow-x: auto;
      gap: 4px;
      scrollbar-width: none;
    }
    .month-tabs::-webkit-scrollbar { display: none; }

    .month-tab {
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
      transition: color 0.15s ease, border-color 0.15s ease;
    }

    .month-tab:hover { color: var(--text-main); }
    .month-tab.active {
      color: var(--color-accent);
      border-bottom-color: var(--color-accent);
      font-weight: 600;
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 20px 24px;
      max-width: 1440px;
      margin: 0 auto;
      width: 100%;
    }

    /* Calendar Grid */
    .calendar-container {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-card);
      box-shadow: var(--edge-light), var(--shadow-card);
      overflow: hidden;
    }

    .calendar-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--color-paper);
    }

    .calendar-title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: var(--tracking-display);
      color: var(--color-ink);
      overflow-wrap: break-word;
      min-width: 0;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      border-bottom: 1px solid var(--border-color);
    }

    .dow-header {
      padding: 10px;
      text-align: center;
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      background: var(--color-paper-2);
      color: var(--text-muted);
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      text-transform: none;
      letter-spacing: 0.02em;
    }
    .dow-header:last-child { border-right: none; }

    .day-cell {
      min-height: 112px;
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 8px;
      background: var(--card-bg);
      display: flex;
      flex-direction: column;
      position: relative;
      cursor: pointer;
      transition: background 0.12s ease;
    }

    .day-cell:hover { background: var(--color-paper); }
    .day-cell:nth-child(7n) { border-right: none; }

    .day-cell.other-month {
      background: var(--color-paper-3);
      opacity: 0.45;
    }

    .day-cell.weekend-col {
      background: color-mix(in oklab, var(--color-paper-2) 60%, var(--card-bg));
    }

    .day-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .day-num {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
    }

    .holiday-pill {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: var(--radius-pill);
      line-height: 1.25;
      text-align: right;
      max-width: 100px;
    }
    .holiday-pill.premium {
      background: color-mix(in oklab, var(--danger) 16%, transparent);
      color: var(--danger);
    }
    .holiday-pill.standard {
      background: color-mix(in oklab, var(--color-accent) 18%, transparent);
      color: var(--color-accent);
    }

    .assignment-chip {
      margin-top: auto;
      padding: 6px 8px;
      border-radius: var(--radius-inner);
      font-size: 12px;
      font-weight: 600;
      color: var(--color-light);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-chip);
    }

    .unassigned-chip {
      background: var(--color-paper-2);
      color: var(--danger);
      border: 1px dashed var(--danger);
      box-shadow: none;
      font-size: 11px;
    }

    .conflict-badges {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 3px;
    }

    .conflict-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-error { background: var(--danger); }
    .dot-warning { background: var(--warning); }
    .dot-attention { background: var(--info); }

    .calendar-footer {
      padding: 12px 20px;
      font-size: 12px;
      color: var(--text-muted);
      background: var(--color-paper);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Modals & Dialogs */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: color-mix(in oklab, var(--color-ink) 70%, transparent);
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }

    .modal {
      background: var(--card-bg);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-cast);
      max-width: 650px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.15s ease-out;
    }

    .modal-wide { max-width: 860px; }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 14px 20px;
      background: var(--color-ink);
      background-image:
        radial-gradient(ellipse at 85% 0%, var(--caustic-modal-1) 0%, transparent 60%),
        radial-gradient(ellipse at 15% 100%, var(--caustic-modal-2) 0%, transparent 50%);
      color: var(--color-light);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 600;
      letter-spacing: var(--tracking-display);
      overflow-wrap: break-word;
      min-width: 0;
    }
    .modal-close {
      background: none; border: none; color: var(--color-light); font-size: 22px; cursor: pointer;
      line-height: 1; padding: 0 4px;
    }
    .modal-close:hover { opacity: 0.8; }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      font-size: 13px;
    }

    .modal-footer {
      padding: 12px 20px;
      background: var(--color-paper);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .form-group {
      margin-bottom: 14px;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 4px;
    }
    .form-input, .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-inner);
      font-family: var(--font-body);
      font-size: 13px;
      background: var(--card-bg);
      color: var(--text-main);
      outline: none;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--color-focus);
      box-shadow: 0 0 0 2px var(--color-accent-soft);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .item-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-inner);
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .color-picker-row {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .color-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .color-swatch.selected {
      border-color: var(--color-ink);
      transform: scale(1.1);
    }

    /* Matrix Table */
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .matrix-table th, .matrix-table td {
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      text-align: left;
    }
    .matrix-table th { background: var(--color-paper-2); font-weight: 600; }
    .matrix-print-only { display: none; }
    .matrix-screen-only { display: inline; }

    /* Alert Banner */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--color-ink);
      color: var(--color-light);
      padding: 12px 20px;
      border-radius: var(--radius-inner);
      font-size: 13px;
      font-weight: 600;
      box-shadow: var(--shadow-cast);
      z-index: 200;
      display: none;
      align-items: center;
      gap: 10px;
    }

    #print-all-container { display: none; }
    .print-page-title { display: none; }
    .breakdown-table { width:100%; border-collapse:collapse; font-size:13px; }
    .breakdown-table th, .breakdown-table td { border:1px solid var(--border-color); padding:8px 10px; text-align:center; }
    .breakdown-table th { background:var(--color-paper-2); font-weight:600; }
    .breakdown-table td:first-child, .breakdown-table th:first-child { text-align:left; }
    .breakdown-table tr.totals td { background:var(--color-paper-3); font-weight:700; }
    .bd-bar { display:inline-block; height:10px; border-radius:3px; vertical-align:middle; margin-right:6px; }

    /* Print Stylesheet */
    @media print {
      @page {
        size: landscape;
        margin: 0;
      }
      header, .ribbon, .month-tabs, .btn, .modal-overlay {
        display: none !important;
      }
      body {
        background: var(--color-print-paper) !important;
        color: var(--color-print-ink) !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      main { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
      .print-page-title {
        display: block !important;
        text-align: center !important;
        font-size: 20px !important;
        font-weight: 700 !important;
        padding: 4px 0 10px 0 !important;
        color: var(--color-print-ink) !important;
      }
      .calendar-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0.35in 0.45in !important;
        break-after: page;
        page-break-after: always;
      }
      .day-cell { min-height: 90px !important; border: 1px solid var(--color-print-ink) !important; }
      .assignment-chip {
        color: var(--color-print-ink) !important;
        background: transparent !important;
        border: 1px solid var(--color-print-ink) !important;
        font-weight: 700 !important;
      }
      .matrix-print-hide {
        display: none !important;
      }
      .print-hide {
        display: none !important;
      }
      .matrix-screen-only {
        display: none !important;
      }
      .matrix-print-only {
        display: inline !important;
      }
      .matrix-table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      .matrix-table th, .matrix-table td {
        border: 1px solid var(--color-print-ink) !important;
        padding: 6px 10px !important;
        color: var(--color-print-ink) !important;
        background: transparent !important;
        font-size: 11pt !important;
      }
      body.printing-all #view-calendar-wrapper,
      body.printing-all #view-matrix-wrapper,
      body.printing-all #view-breakdown-wrapper { display: none !important; }
      body.printing-all #print-all-container { display: block !important; }
    }
  </style>
</head>
<body>

  <!-- Top Navigation Bar -->
  <header>
    <div class="brand">
      <div class="brand-title">Pennsylvania State Police</div>
      <div class="brand-badge">Fire Marshal On-Call Scheduler</div>
    </div>
    <div class="header-controls">
      <label style="font-size:12px; font-weight:600; opacity:0.9;">Cycle:</label>
      <select id="cycle-select" class="cycle-select"></select>
      <button id="btn-open-add-cycle" class="btn btn-outline" title="Add New Year or Schedule Block">+ Add Year / Block</button>
      <button id="btn-undo" class="btn btn-outline" title="Undo (Ctrl+Z)">&#8630; Undo</button>
      <button id="btn-redo" class="btn btn-outline" title="Redo (Ctrl+Y)">&#8631; Redo</button>
      <button id="btn-solve" class="btn btn-light">&#9881; Auto-Generate Schedule</button>
      <button id="btn-clear-calendar" class="btn btn-danger" title="Clear all shift assignments for the selected calendar">&#128465; Clear Calendar</button>
    </div>
  </header>

  <!-- Action Ribbon (Single-Line Compact Menu) -->
  <div class="ribbon">
    <div class="tab-group">
      <button id="tab-calendar-view" class="tab-btn active">Calendar</button>
      <button id="tab-matrix-view" class="tab-btn">Matrix</button>
      <button id="tab-breakdown-view" class="tab-btn">Breakdown</button>
    </div>
    <div class="ribbon-actions">
      <button id="btn-open-roster" class="btn btn-outline-dark" title="Personnel Roster">&#128101; Roster (<span id="roster-count">7</span>)</button>
      <button id="btn-open-blackouts" class="btn btn-outline-dark" title="Blackouts &amp; Leave">&#128197; Blackouts (<span id="blackout-count">0</span>)</button>
      <button id="btn-open-prefs" class="btn btn-outline-dark" title="Requested Weekends">&#11088; Requests (<span id="pref-count">0</span>)</button>
      <button id="btn-print" class="btn btn-outline-dark" title="Print current month view">&#128424; Print</button>
      <button id="btn-print-all" class="btn btn-outline-dark" title="Print every month of the active cycle in one go">&#128424; Print All</button>
      <div class="ribbon-divider"></div>
      <button id="btn-open-guide" class="btn btn-outline-dark" title="Operational User Guide &amp; Task Manual">&#128214; How to Use</button>
      <button id="btn-open-pinned" class="btn btn-outline-dark" style="display:none;" title="Pinned Notes &amp; Switch Suggestions">&#128204; Pinned Notes (<span id="pinned-count">0</span>)</button>
      <button id="btn-open-rules" class="btn btn-outline-dark" title="Schedule Rules &amp; Constraints Specification">&#128203; Schedule Rules</button>
      <div class="ribbon-divider"></div>
      <button id="btn-backup-export" class="btn btn-outline-dark" title="Download all data (roster, blackouts, requests, schedules) as a JSON backup file">&#128190; Backup</button>
      <button id="btn-backup-restore" class="btn btn-outline-dark" title="Restore everything from a JSON backup file">&#128194; Restore</button>
      <input type="file" id="backup-file-input" accept=".json,application/json" style="display:none;">
      <div class="ribbon-divider"></div>
      <button id="btn-open-import" class="btn btn-outline-dark" title="Import Schedule from CSV">&#128196; Import</button>
      <button id="btn-export-excel" class="btn btn-primary" title="Export current schedule to Excel (XLSX)">&#128229; Export Excel</button>
    </div>
  </div>

  <!-- Month Navigation Tabs (For Calendar View) -->
  <div id="month-tabs-bar" class="month-tabs"></div>

  <!-- Main Content Area -->
  <main id="main-content">
    <div id="view-calendar-wrapper">
      <div class="calendar-container">
        <div class="print-page-title">Troop H Fire Marshal Unit Schedule</div>
        <div class="calendar-header">
          <div id="calendar-month-title" class="calendar-title">January 2027</div>
          <div style="font-size: 13px; color: var(--text-muted);" id="calendar-summary-stat"></div>
        </div>
        <div class="calendar-grid">
          <div class="dow-header">Monday</div>
          <div class="dow-header">Tuesday</div>
          <div class="dow-header">Wednesday</div>
          <div class="dow-header">Thursday</div>
          <div class="dow-header">Friday</div>
          <div class="dow-header">Saturday</div>
          <div class="dow-header">Sunday</div>
        </div>
        <div id="calendar-days-grid" class="calendar-grid"></div>
        <div class="calendar-footer">
          <div><strong>Rule Note:</strong> On call starts PM that day (after scheduled shift) through 0600hrs the next morning. <span class="print-hide">Click any date cell to manually adjust shift assignment.</span></div>
          <div id="exemption-note" style="color:var(--danger); font-weight:600; display:none;">* Administrative Exemption: Manual Alternate Weekday Assignment</div>
        </div>
      </div>
    </div>

    <!-- Shift Breakdown View (Hidden by default) -->
    <div id="view-breakdown-wrapper" style="display:none;">
      <div class="calendar-container" style="padding:20px;">
        <h2 style="font-size:18px; margin-bottom:4px;">Shift Breakdown</h2>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Number of on-call shifts (days) per team member for the active cycle. Use this to check how evenly shifts are distributed.</div>
        <div id="breakdown-table-container"></div>
      </div>
    </div>

    <!-- Print All container (only visible when printing all months) -->
    <div id="print-all-container"></div>

    <!-- Matrix View (Hidden by default) -->
    <div id="view-matrix-wrapper" style="display:none;">
      <div class="calendar-container" style="padding:20px;">
        <div class="print-page-title">Troop H Fire Marshal Unit Schedule</div>
        <h2 style="font-size:18px; margin-bottom:16px;">Cycle Shift Matrix &amp; Weekend Rest Overview</h2>
        <div id="matrix-table-container"></div>
      </div>
    </div>
  </main>

  <!-- Modal Backdrop Overlay -->
  <div id="modal-overlay" class="modal-overlay">

    <!-- 1. Personnel Roster Modal -->
    <div id="modal-roster" class="modal modal-wide" style="display:none;" role="dialog" aria-modal="true" aria-label="Personnel roster manager">
      <div class="modal-header">
        <div class="modal-title">&#128101; Personnel Roster Manager</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Add Member Form -->
        <div style="background:var(--color-paper-2); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div id="member-form-title" style="font-weight:700; font-size:14px; margin-bottom:12px; color:var(--primary);">+ Add Investigator to Roster</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Rank</label>
              <input type="text" id="member-rank-input" class="form-input" placeholder="e.g. Trooper" value="Trooper">
            </div>
            <div class="form-group">
              <label class="form-label">First Name</label>
              <input type="text" id="member-firstname-input" class="form-input" placeholder="e.g. Sean">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Investigator Last Name *</label>
              <input type="text" id="member-name-input" class="form-input" placeholder="e.g. POLCHA">
            </div>
            <div class="form-group">
              <label class="form-label">Role Classification *</label>
              <select id="member-role-input" class="form-select">
                <option value="FT">Full-Time Fire Marshal (FT)</option>
                <option value="ALT">Alternate Fire Marshal (ALT)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Baseline Preferred Weekday</label>
              <select id="member-weekday-input" class="form-select">
                <option value="">None / Alternate Rotational</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Badge Color</label>
              <input type="color" id="member-color-input" class="form-input" value="#1e3a8a" style="height:38px; padding:2px;">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Active Start Date</label>
              <input type="date" id="member-start-input" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Active End Date (Optional)</label>
              <input type="date" id="member-end-input" class="form-input" placeholder="Leave blank if indefinite">
            </div>
          </div>
          <div class="form-group" id="member-prefday-group" style="display:none;">
            <label class="form-label">Preferred Day If Available (rotational members only)</label>
            <select id="member-prefday-input" class="form-select">
              <option value="">No preference (pure rotation)</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
            </select>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Used only when it keeps shift counts fair and rest/blackout rules allow it.</div>
          </div>
          <div class="form-group" id="member-alt-quota-group" style="display:none;">
            <label class="form-label">Weekends Per 6 Months (Alternate Fire Marshal Quota)</label>
            <input type="number" id="member-alt-quota-input" class="form-input" value="3" min="0" max="26">
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Default is 3 weekends per 6-month block (6 for Full Year). Increase or decrease to adjust scheduled weekends.</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="btn-save-new-member" class="btn btn-primary" style="flex:1; justify-content:center; padding:9px;">+ Add Investigator to Active Roster</button>
            <button id="btn-cancel-edit" class="btn btn-outline-dark" style="display:none; padding:9px;">Cancel Edit</button>
          </div>
        </div>

        <div id="alt-weekends-manager-block" style="background:var(--warning-soft); padding:14px 16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--warning-soft-border);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
              <div style="font-weight:700; font-size:13px; color:var(--warning-text);">Alternate Fire Marshals: Weekends Per 6 Months</div>
              <div style="font-size:11px; color:var(--warning-border);">Adjust the number of weekends each Alternate Fire Marshal is scheduled per 6-month block (default: 3).</div>
            </div>
          </div>
          <div id="alt-quota-controls-list" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px;"></div>
        </div>

        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Active Roster (<span id="modal-roster-count">0</span> Members)</div>
        <div id="roster-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 2. Blackouts & Vacations Modal -->
    <div id="modal-blackouts" class="modal modal-wide" style="display:none;" role="dialog" aria-modal="true" aria-label="Vacations and blackouts">
      <div class="modal-header">
        <div class="modal-title">&#128197; Vacations & Blackouts Booking</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--color-paper-2); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:var(--primary);">+ Book New Leave / Blackout Range</div>
          <div class="form-group">
            <label class="form-label">Investigator *</label>
            <select id="book-member-select" class="form-select"></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date *</label>
              <input type="date" id="book-start-input" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">End Date *</label>
              <input type="date" id="book-end-input" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Leave Notes / Reason</label>
            <input type="text" id="book-notes-input" class="form-input" placeholder="e.g. Summer Vacation, Hunting, Training, Military Leave">
          </div>
          <button id="btn-save-new-blackout" class="btn btn-primary" style="width:100%; justify-content:center; padding:9px;">Book Blackout Range</button>
        </div>

        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Approved Blackouts (<span id="modal-blackouts-count">0</span>)</div>
        <div id="blackouts-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 3. Add Year / Schedule Block Modal -->
    <div id="modal-prefs" class="modal modal-wide" style="display:none;" role="dialog" aria-modal="true" aria-label="Requested weekends">
      <div class="modal-header">
        <div class="modal-title">&#11088; Requested Weekends (Want to Work)</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px; color:var(--text-muted);">
          Weekends listed here are locked in for that person when you click Auto-Generate. All other weekends are scheduled around them.
          A request is skipped only if it is impossible (blackout, same weekend requested by two people, or back-to-back weekends for one person), and you will be told which.
        </p>
        <div style="background:var(--color-paper-2); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border-color);">
          <div class="form-group">
            <label class="form-label">Investigator *</label>
            <select id="pref-member-select" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Weekend (current schedule block) *</label>
            <select id="pref-weekend-select" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <input type="text" id="pref-notes-input" class="form-input" placeholder="e.g. Swapped with Terek">
          </div>
          <button id="btn-save-new-pref" class="btn btn-primary" style="width:100%; justify-content:center; padding:9px;">Add Requested Weekend</button>
        </div>
        <div style="font-weight:700; font-size:14px; margin-bottom:10px;">Requests for this block (<span id="modal-pref-count">0</span>)</div>
        <div id="pref-items-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 3b. Add Year / Schedule Block Modal -->
    <div id="modal-add-cycle" class="modal" style="display:none;" role="dialog" aria-modal="true" aria-label="Add year or block">
      <div class="modal-header">
        <div class="modal-title">&#128197; Add Year / Schedule Block</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px; color:var(--text-muted);">
          Create a new on-call schedule block for any future year (e.g. 2028, 2029). Pennsylvania State Police official holidays will be calculated automatically.
        </p>
        <div class="form-group">
          <label class="form-label">Calendar Year *</label>
          <input type="number" id="new-cycle-year" class="form-input" value="2028" min="2025" max="2050">
        </div>
        <div class="form-group">
          <label class="form-label">Schedule Block Type *</label>
          <select id="new-cycle-block" class="form-select">
            <option value="FULL">Full Calendar Year (Jan 1 to Dec 31)</option>
            <option value="H1">First Half / H1 (Jan 1 to Jun 30)</option>
            <option value="H2">Second Half / H2 (Jul 1 to Dec 31)</option>
          </select>
        </div>
        <div style="background:var(--color-paper); padding:12px; border-radius:6px; border:1px solid var(--border-color); margin-bottom:14px;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="new-cycle-carry-roster" checked>
            Carry forward current active personnel roster
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-confirm-add-cycle" class="btn btn-primary">Create Schedule Block</button>
      </div>
    </div>

    <!-- 4. Reassign Shift Modal -->
    <div id="modal-reassign" class="modal" style="width:400px; display:none;">
      <div class="modal-header">
        <div id="reassign-date-title" class="modal-title">Reassign Shift</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Assign Duty Investigator</label>
          <select id="reassign-member-select" class="form-select"></select>
        </div>
        <div id="reassign-conflict-preview" style="padding:10px; border-radius:6px; background:var(--color-paper); font-size:12px; min-height:40px;">
          Select an investigator to evaluate fatigue rest rules.
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-clear-shift" class="btn btn-danger" style="margin-right:auto;">Clear Shift</button>
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-save-shift" class="btn btn-primary">Save Assignment</button>
      </div>
    </div>

    <!-- 5. Import Modal -->
    <div id="modal-import" class="modal modal-wide" style="display:none;" role="dialog" aria-modal="true" aria-label="Import schedule">
      <div class="modal-header">
        <div class="modal-title">&#128196; Import Barracks Schedule</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div style="border: 2px dashed var(--border-color); border-radius:10px; padding:30px 20px; text-align:center; background:var(--color-paper); cursor:pointer;" id="drop-zone">
          <div style="font-size:36px; margin-bottom:8px;">&#128194;</div>
          <div style="font-weight:700; font-size:15px; margin-bottom:4px;">Drag & Drop Excel (.xlsx) or CSV Schedule</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Supports standard 7-Column Barracks Calendars and 2-Column Date Lists</div>
          <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none;">
          <button type="button" class="btn btn-primary" onclick="document.getElementById('file-input').click()">Browse Computer Files</button>
        </div>
        <div id="import-preview-box" style="margin-top:16px; display:none;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
      </div>
    </div>

    <!-- 6. Unmatched Alias Reconcile Modal -->
    <div id="modal-alias" class="modal modal-wide" style="display:none;" role="dialog" aria-modal="true" aria-label="Resolve unmatched names">
      <div class="modal-header">
        <div class="modal-title">Reconcile Imported Personnel Names</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px; color:var(--text-muted);">
          The imported schedule contains names not matched in your active roster. Map each alias to an existing investigator or create a historical record:
        </p>
        <div id="alias-mapping-list"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-confirm-alias" class="btn btn-primary">Apply Reconciled Schedule</button>
      </div>
    </div>

    <!-- 7. Clear Calendar Scope Modal -->
    <div id="modal-clear-calendar" class="modal" style="width:500px; display:none;" role="dialog" aria-modal="true" aria-label="Clear calendar options">
      <div class="modal-header" style="background:var(--danger);">
        <div class="modal-title">&#128465; Clear Shift Assignments</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px; color:var(--text-main); font-weight:600;">
          Select the scope of shift assignments you want to wipe:
        </p>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
          <label style="display:flex; align-items:flex-start; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:8px; cursor:pointer; background:var(--card-bg);">
            <input type="radio" name="clear-scope" value="month" id="clear-scope-month" checked style="margin-top:4px;">
            <div style="flex:1;">
              <div style="font-weight:700; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <span>Clear Single Month:</span>
                <select id="clear-month-select" class="form-select" style="width:auto; padding:3px 8px; font-size:12px;"></select>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Wipes scheduled shifts for only this selected month.</div>
            </div>
          </label>
          <label style="display:flex; align-items:flex-start; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:8px; cursor:pointer; background:var(--card-bg);">
            <input type="radio" name="clear-scope" value="cycle" id="clear-scope-cycle" style="margin-top:4px;">
            <div style="flex:1;">
              <div style="font-weight:700;" id="clear-cycle-label">Clear Entire Calendar Block</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Wipes all shifts across the entire active schedule block.</div>
            </div>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-dark" onclick="closeAllModals()">Cancel</button>
        <button id="btn-proceed-clear" class="btn btn-danger">&#128465; Clear Shifts…</button>
      </div>
    </div>

    <!-- 8. How to Use Modal -->
    <div id="modal-guide" class="modal modal-wide" style="display:none; max-width:880px;" role="dialog" aria-modal="true" aria-label="How to use calendar manual">
      <div class="modal-header">
        <div class="modal-title">&#128214; On-Call Calendar: User Guide &amp; Feature Manual</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body doc-content" style="max-height:75vh; overflow-y:auto; padding:24px;">
        ${userGuideHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeAllModals()">Close Guide</button>
      </div>
    </div>

    <!-- 9. Schedule Rules Modal -->
    <div id="modal-rules" class="modal modal-wide" style="display:none; max-width:880px;" role="dialog" aria-modal="true" aria-label="Schedule rules and constraints">
      <div class="modal-header">
        <div class="modal-title">&#128203; Troop H Fire Marshal: Schedule Rules &amp; Invariants</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body doc-content" style="max-height:75vh; overflow-y:auto; padding:24px;">
        ${scheduleRulesHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeAllModals()">Close Rules</button>
      </div>
    </div>

    <!-- 10. Pinned Notes Modal -->
    <div id="modal-pinned-notes" class="modal modal-wide" style="display:none; max-width:820px;" role="dialog" aria-modal="true" aria-label="Pinned notes and switch suggestions">
      <div class="modal-header">
        <div class="modal-title">&#128204; Pinned Notes &amp; Switch Suggestions</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body" style="max-height:72vh; overflow-y:auto; padding:20px;">
        <div id="pinned-notes-list"></div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between;">
        <button id="btn-clear-all-pinned" class="btn btn-outline-dark" style="color:var(--danger); border-color:var(--danger-border);">&#128465; Clear All Pinned Notes</button>
        <button class="btn btn-primary" onclick="closeAllModals()">Close</button>
      </div>
    </div>

    <!-- 11. Schedule Attention & Suggestions Modal -->
    <div id="modal-schedule-attention" class="modal modal-wide" style="display:none; max-width:760px;" role="dialog" aria-modal="true" aria-label="Schedule generation attention dialog">
      <div class="modal-header">
        <div class="modal-title">&#9888; Schedule Generated &mdash; Attention Needed</div>
        <button class="modal-close" onclick="closeAllModals()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body" style="max-height:72vh; overflow-y:auto; padding:20px;">
        <div id="attention-dialog-content" style="white-space:pre-wrap; font-size:13px; line-height:1.6; color:var(--color-ink); background:var(--color-paper-2); padding:16px; border-radius:8px; border:1px solid var(--border-color);"></div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px;">
        <button id="btn-pin-active-notice" class="btn btn-primary">&#128204; Pin Note &amp; Suggestions</button>
        <button class="btn btn-outline-dark" onclick="closeAllModals()">OK / Dismiss</button>
      </div>
    </div>

  </div>

  <!-- Notification Toast -->
  <div id="toast" class="toast"></div>

  <!-- Inlined SheetJS Library -->
  <script>
    ${sheetJsCode}
  </script>

  <!-- Inlined Domain & Architecture Modules -->
  <script>
    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    // --- domain_data.js ---
    ${domainDataCode}

    // --- csp_solver.js ---
    ${cspSolverCode}

    // --- conflict_engine.js ---
    ${conflictEngineCode}

    // --- excel_engine.js ---
    ${excelEngineCode}

    // --- storage_adapter.js ---
    ${storageAdapterCode}

    // --- Algorithmic Holiday Generator for Any Year ---
    function getNthWeekdayOfMonth(year, monthIndex, weekday, n) {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, monthIndex, d);
        if (dt.getMonth() !== monthIndex) break;
        if (dt.getDay() === weekday) {
          count++;
          if (count === n) return dt;
        }
      }
      return null;
    }

    function getLastWeekdayOfMonth(year, monthIndex, weekday) {
      let last = null;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, monthIndex, d);
        if (dt.getMonth() !== monthIndex) break;
        if (dt.getDay() === weekday) last = dt;
      }
      return last;
    }

    function getEasterSunday(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }

    function generateOfficialPSPHolidays(year) {
      const holidays = [];
      function addHol(dt, name, type) {
        if (!dt) return;
        holidays.push({ date: formatDate(dt), year, name, type });
      }

      // New Year's Day: Jan 1
      const ny = new Date(year, 0, 1);
      const nyDow = ny.getDay();
      addHol(ny, "New Year's Day", nyDow === 5 ? 'attached_fri' : (nyDow === 1 ? 'attached_mon' : (nyDow === 0 || nyDow === 6 ? 'weekend' : 'midweek')));

      // Martin Luther King Day: 3rd Monday in Jan
      addHol(getNthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Day", 'attached_mon');

      // Presidents' Day: 3rd Monday in Feb
      addHol(getNthWeekdayOfMonth(year, 1, 1, 3), "Presidents' Day", 'attached_mon');

      // Good Friday: 2 days before Easter Sunday
      const easter = getEasterSunday(year);
      const goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
      addHol(goodFriday, 'Good Friday', 'attached_fri');

      // Memorial Day: Last Monday in May
      addHol(getLastWeekdayOfMonth(year, 4, 1), 'Memorial Day', 'attached_mon');

      // Juneteenth: June 19
      const june19 = new Date(year, 5, 19);
      const jDow = june19.getDay();
      addHol(june19, 'Juneteenth', jDow === 5 ? 'attached_fri' : (jDow === 1 ? 'attached_mon' : (jDow === 0 || jDow === 6 ? 'weekend' : 'midweek')));

      // Independence Day: July 4 (always July 4th, no observed holiday)
      const jul4 = new Date(year, 6, 4);
      const julDow = jul4.getDay();
      addHol(jul4, 'Independence Day', julDow === 5 ? 'attached_fri' : (julDow === 1 ? 'attached_mon' : (julDow === 0 || julDow === 6 ? 'weekend' : 'midweek')));

      // Labor Day: 1st Monday in Sept
      addHol(getNthWeekdayOfMonth(year, 8, 1, 1), 'Labor Day', 'attached_mon');

      // Columbus Day: 2nd Monday in Oct
      addHol(getNthWeekdayOfMonth(year, 9, 1, 2), 'Columbus Day', 'attached_mon');

      // General Election Day: Tuesday after 1st Monday in Nov
      const firstMonNov = getNthWeekdayOfMonth(year, 10, 1, 1);
      const electionDay = new Date(firstMonNov.getTime() + 24 * 60 * 60 * 1000);
      addHol(electionDay, 'General Election Day', 'midweek');

      // Veterans Day: Nov 11
      const vetDay = new Date(year, 10, 11);
      const vetDow = vetDay.getDay();
      addHol(vetDay, 'Veterans Day', vetDow === 5 ? 'attached_fri' : (vetDow === 1 ? 'attached_mon' : (vetDow === 0 || vetDow === 6 ? 'weekend' : 'midweek')));

      // Thanksgiving Day: 4th Thursday in Nov
      addHol(getNthWeekdayOfMonth(year, 10, 4, 4), 'Thanksgiving Day', 'midweek');

      // Christmas Day: Dec 25
      const xmas = new Date(year, 11, 25);
      const xDow = xmas.getDay();
      addHol(xmas, 'Christmas Day', xDow === 5 ? 'attached_fri' : (xDow === 1 ? 'attached_mon' : (xDow === 0 || xDow === 6 ? 'weekend' : 'midweek')));

      return holidays;
    }

    // --- UI Controller & Application Bootstrap ---
    const storage = new StorageAdapter();
    window.appState = storage.state;
    if (!window.appState.preferredWeekends) window.appState.preferredWeekends = [];

    let activeMonthIdx = 0; // 0=Jan
    let selectedDateForReassign = null;
    let pendingImportShifts = null;

    // Toast notification helper
    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3200);
    }

    // DOM Elements
    const cycleSelect = document.getElementById('cycle-select');
    const monthTabsBar = document.getElementById('month-tabs-bar');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const calendarSummaryStat = document.getElementById('calendar-summary-stat');
    const exemptionNote = document.getElementById('exemption-note');
    const rosterCount = document.getElementById('roster-count');
    const blackoutCount = document.getElementById('blackout-count');

    // Tab buttons
    const tabCalendarView = document.getElementById('tab-calendar-view');
    const tabMatrixView = document.getElementById('tab-matrix-view');
    const viewCalendarWrapper = document.getElementById('view-calendar-wrapper');
    const viewMatrixWrapper = document.getElementById('view-matrix-wrapper');
    const tabBreakdownView = document.getElementById('tab-breakdown-view');
    const viewBreakdownWrapper = document.getElementById('view-breakdown-wrapper');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const modalRoster = document.getElementById('modal-roster');
    const modalBlackouts = document.getElementById('modal-blackouts');
    const modalPrefs = document.getElementById('modal-prefs');
    const modalAddCycle = document.getElementById('modal-add-cycle');
    const modalReassign = document.getElementById('modal-reassign');
    const modalImport = document.getElementById('modal-import');
    const modalAlias = document.getElementById('modal-alias');
    const modalClearCalendar = document.getElementById('modal-clear-calendar');
    const modalGuide = document.getElementById('modal-guide');
    const modalRules = document.getElementById('modal-rules');
    const modalPinnedNotes = document.getElementById('modal-pinned-notes');
    const modalScheduleAttention = document.getElementById('modal-schedule-attention');

    function closeAllModals() {
      modalOverlay.classList.remove('open');
      modalRoster.style.display = 'none';
      modalBlackouts.style.display = 'none';
      modalPrefs.style.display = 'none';
      modalAddCycle.style.display = 'none';
      modalReassign.style.display = 'none';
      modalImport.style.display = 'none';
      modalAlias.style.display = 'none';
      if (modalClearCalendar) modalClearCalendar.style.display = 'none';
      if (modalGuide) modalGuide.style.display = 'none';
      if (modalRules) modalRules.style.display = 'none';
      if (modalPinnedNotes) modalPinnedNotes.style.display = 'none';
      if (modalScheduleAttention) modalScheduleAttention.style.display = 'none';
      if (typeof resetMemberForm === 'function') resetMemberForm();
    }

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeAllModals();
    });

    // Keyboard handlers:
    // 1. Esc closes the open menu/modal
    // 2. Enter in a menu accepts changes and saves
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (modalOverlay.classList.contains('open')) {
          closeAllModals();
        }
        return;
      }

      if (e.key === 'Enter') {
        if (modalOverlay.classList.contains('open')) {
          if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) {
            return;
          }
          e.preventDefault();
          if (modalRoster.style.display !== 'none') {
            document.getElementById('btn-save-new-member').click();
          } else if (modalBlackouts.style.display !== 'none') {
            document.getElementById('btn-save-new-blackout').click();
          } else if (modalPrefs.style.display !== 'none') {
            document.getElementById('btn-save-new-pref').click();
          } else if (modalAddCycle.style.display !== 'none') {
            document.getElementById('btn-confirm-add-cycle').click();
          } else if (modalReassign.style.display !== 'none') {
            document.getElementById('btn-save-shift').click();
          } else if (modalAlias.style.display !== 'none') {
            document.getElementById('btn-confirm-alias').click();
          } else if (modalClearCalendar && modalClearCalendar.style.display !== 'none') {
            document.getElementById('btn-proceed-clear').click();
          }
        }
      }
    });

    // Helper: Determine if a member is active for a given cycle
    function isMemberInCycle(m, cycle) {
      if (!cycle) return true;
      if (m.activeEnd && cycle.startDate > m.activeEnd) return false;
      if (m.activeStart && cycle.endDate < m.activeStart) return false;
      return true;
    }

    // Helper: Get active members for the currently selected cycle
    function getCycleRoster() {
      const cycle = getActiveCycle();
      return window.appState.roster.filter(m => isMemberInCycle(m, cycle));
    }

    function getActiveCycle() {
      if (!window.appState.cycles[window.appState.activeCycleId]) {
        // Fallback to first available cycle
        const keys = Object.keys(window.appState.cycles);
        if (keys.length > 0) window.appState.activeCycleId = keys[0];
      }
      return window.appState.cycles[window.appState.activeCycleId];
    }

    // Helper: Synchronize cycle assignments across H1, H2, and FULL
    function syncCycleAssignments(year) {
      if (!window.appState || !window.appState.cycles) return;
      const targetYears = year ? [parseInt(year)] : [...new Set(Object.values(window.appState.cycles).map(c => c.year).filter(Boolean))];
      targetYears.forEach(y => {
        const full = window.appState.cycles[\`\${y}-FULL\`];
        const h1 = window.appState.cycles[\`\${y}-H1\`];
        const h2 = window.appState.cycles[\`\${y}-H2\`];
        if (full) {
          if (!full.assignments) full.assignments = {};
          if (h1 && h1.assignments) {
            for (const [d, id] of Object.entries(h1.assignments)) {
              if (id && !full.assignments[d]) full.assignments[d] = id;
            }
          }
          if (h2 && h2.assignments) {
            for (const [d, id] of Object.entries(h2.assignments)) {
              if (id && !full.assignments[d]) full.assignments[d] = id;
            }
          }
        }
        if (full && full.assignments) {
          for (const [d, id] of Object.entries(full.assignments)) {
            if (!id) continue;
            if (h1 && d >= h1.startDate && d <= h1.endDate) {
              if (!h1.assignments) h1.assignments = {};
              if (!h1.assignments[d]) h1.assignments[d] = id;
            }
            if (h2 && d >= h2.startDate && d <= h2.endDate) {
              if (!h2.assignments) h2.assignments = {};
              if (!h2.assignments[d]) h2.assignments[d] = id;
            }
          }
        }
      });
    }

    function syncShiftToSiblings(dateStr, memberId) {
      if (!dateStr || !window.appState || !window.appState.cycles) return;
      const [yStr, mStr] = dateStr.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr);
      const full = window.appState.cycles[\`\${y}-FULL\`];
      const halfId = m <= 6 ? \`\${y}-H1\` : \`\${y}-H2\`;
      const half = window.appState.cycles[halfId];
      if (full) {
        if (!full.assignments) full.assignments = {};
        if (memberId) full.assignments[dateStr] = memberId;
        else delete full.assignments[dateStr];
      }
      if (half) {
        if (!half.assignments) half.assignments = {};
        if (memberId) half.assignments[dateStr] = memberId;
        else delete half.assignments[dateStr];
      }
    }

    // Refresh Cycle Selector Options
    function refreshCycleDropdown() {
      const cycleKeys = Object.keys(window.appState.cycles);
      cycleSelect.innerHTML = cycleKeys.map(k => {
        const c = window.appState.cycles[k];
        const label = c.blockType === 'FULL' ? \`\${c.year} Full Year\` : \`\${c.year} \${c.blockType} (\${c.startDate} to \${c.endDate})\`;
        return \`<option value="\${c.id}" \${c.id === window.appState.activeCycleId ? 'selected' : ''}>\${label}</option>\`;
      }).join('');
    }

    // Refresh UI
    function renderApp() {
      syncCycleAssignments();
      refreshCycleDropdown();
      const cycle = getActiveCycle();
      rosterCount.textContent = getCycleRoster().length;
      blackoutCount.textContent = cycleBlackouts().length;
      document.getElementById('pref-count').textContent = cyclePrefs().length;
      updatePinnedNotesButton();

      renderMonthTabs();
      renderCalendar();
      renderMatrix();
      renderBreakdown();
    }

    function renderMonthTabs() {
      const cycle = getActiveCycle();
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const months = [];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);

      while (curr <= last) {
        months.push({ name: monthNames[curr.getMonth()], idx: curr.getMonth(), year: curr.getFullYear() });
        curr.setMonth(curr.getMonth() + 1);
      }

      // If activeMonthIdx is outside the cycle's months and not -1 (Show All), reset it
      const validIndices = months.map(m => m.idx);
      if (!validIndices.includes(activeMonthIdx) && activeMonthIdx !== -1) {
        activeMonthIdx = validIndices[0];
      }

      monthTabsBar.innerHTML = \`
        <button class="month-tab \${activeMonthIdx === -1 ? 'active' : ''}" data-idx="all">Show All</button>
        \${months.map(m => \`
          <button class="month-tab \${m.idx === activeMonthIdx ? 'active' : ''}" data-idx="\${m.idx}">
            \${esc(m.name)} \${m.year}
          </button>
        \`).join('')}
      \`;

      monthTabsBar.querySelectorAll('.month-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-idx');
          activeMonthIdx = val === 'all' ? -1 : parseInt(val);
          renderApp();
        });
      });
    }

    function renderSingleMonthHtml(cycle, targetYear, targetMonthIdx, conflicts) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthTitle = \`\${monthNames[targetMonthIdx]} \${targetYear}\`;

      const firstDay = new Date(targetYear, targetMonthIdx, 1);
      const lastDay = new Date(targetYear, targetMonthIdx + 1, 0);
      const firstDow = firstDay.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const mondayOffset = firstDow === 0 ? -6 : (1 - firstDow);
      let weekMonday = addDays(firstDay, mondayOffset);

      let cellsHtml = '';
      let assignedCount = 0;
      const totalMonthDays = lastDay.getDate();
      let hasExemption = false;

      while (weekMonday <= lastDay) {
        for (let i = 0; i < 7; i++) {
          const d = addDays(weekMonday, i);
          const dStr = formatDate(d);
          const isCurrentMonth = d.getMonth() === targetMonthIdx;
          const dow = d.getDay();
          const isWeekend = (dow === 0 || dow === 6);

          const assignedId = cycle.assignments[dStr];
          const member = window.appState.roster.find(m => m.id === assignedId);
          if (isCurrentMonth && assignedId) assignedCount++;

          const holiday = window.appState.holidays.find(h => h.date === dStr);
          const dayConflicts = conflicts[dStr] || [];
          const hasError = dayConflicts.some(c => c.type === 'ERROR');
          const hasWarning = dayConflicts.some(c => c.type === 'WARNING');
          const hasAttention = dayConflicts.some(c => c.type === 'ATTENTION');

          if (dayConflicts.some(c => c.code === 'ALT_WEEKDAY_VIOLATION')) {
            hasExemption = true;
          }

          let chipHtml = '';
          if (member) {
            chipHtml = \`
              <div class="assignment-chip" style="background:\${member.color};">
                <span>\${esc(member.name)}</span>
                <span style="font-size:10px; opacity:0.85;">\${member.role}</span>
              </div>
            \`;
          } else {
            chipHtml = \`<div class="assignment-chip unassigned-chip">UNASSIGNED</div>\`;
          }

          let dotsHtml = '';
          if (hasError || hasWarning || hasAttention) {
            dotsHtml = '<div class="conflict-badges">';
            if (hasError) dotsHtml += '<div class="conflict-dot dot-error" title="Contractual Fatigue / Blackout Conflict"></div>';
            if (hasWarning) dotsHtml += '<div class="conflict-dot dot-warning" title="Warning / Quota Breach"></div>';
            if (hasAttention) dotsHtml += '<div class="conflict-dot dot-attention" title="Multi-Shift Coverage"></div>';
            dotsHtml += '</div>';
          }

          cellsHtml += \`
            <div class="day-cell \${!isCurrentMonth ? 'other-month' : ''} \${isWeekend ? 'weekend-col' : ''}" data-date="\${dStr}">
              <div class="day-top">
                <span class="day-num">\${d.getDate()}</span>
                \${holiday ? \`<span class="holiday-pill \${isPremiumHoliday(holiday) ? 'premium' : 'standard'}" title="\${esc(holiday.name)}\${isPremiumHoliday(holiday) ? ' (premium)' : ' (non-premium)'}">\${esc(holiday.name)}\${isPremiumHoliday(holiday) ? ' (premium)' : ''}</span>\` : ''}
              </div>
              \${dotsHtml}
              \${chipHtml}
            </div>
          \`;
        }
        weekMonday = addDays(weekMonday, 7);
      }

      return \`
        <div class="calendar-container" style="margin-bottom:24px;">
          <div class="print-page-title">Troop H Fire Marshal Unit Schedule</div>
          <div class="calendar-header">
            <div class="calendar-title">\${monthTitle}</div>
            <div class="print-hide" style="font-size: 13px; color: var(--text-muted);">Staffed: \${assignedCount} / \${totalMonthDays} Days</div>
          </div>
          <div class="calendar-grid">
            <div class="dow-header">Monday</div>
            <div class="dow-header">Tuesday</div>
            <div class="dow-header">Wednesday</div>
            <div class="dow-header">Thursday</div>
            <div class="dow-header">Friday</div>
            <div class="dow-header">Saturday</div>
            <div class="dow-header">Sunday</div>
          </div>
          <div class="calendar-grid">\${cellsHtml}</div>
          <div class="calendar-footer">
            <div><strong>Rule Note:</strong> On call starts PM that day (after scheduled shift) through 0600hrs the next morning. <span class="print-hide">Click any date cell to manually adjust shift assignment.</span></div>
            <div style="color:var(--danger); font-weight:600; display:\${hasExemption ? 'block' : 'none'};">* Administrative Exemption: Manual Alternate Weekday Assignment</div>
          </div>
        </div>
      \`;
    }

    // Render 7-Column Calendar Grid
    function renderCalendar() {
      const cycle = getActiveCycle();
      const conflicts = evaluateScheduleConflicts(cycle, window.appState.roster, window.appState.blackouts, window.appState.holidays, cycle.assignments);
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);

      if (activeMonthIdx === -1) {
        const monthHtmls = [];
        let curr = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(end.getFullYear(), end.getMonth(), 1);
        while (curr <= last) {
          monthHtmls.push(renderSingleMonthHtml(cycle, curr.getFullYear(), curr.getMonth(), conflicts));
          curr.setMonth(curr.getMonth() + 1);
        }
        viewCalendarWrapper.innerHTML = monthHtmls.join('');
      } else {
        viewCalendarWrapper.innerHTML = renderSingleMonthHtml(cycle, cycle.year, activeMonthIdx, conflicts);
      }

      // Cell click handler for reassigning
      viewCalendarWrapper.querySelectorAll('.day-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const dateStr = cell.getAttribute('data-date');
          openReassignModal(dateStr);
        });
      });
    }

    // Render Matrix Overview
    function renderMatrix() {
      const cycle = getActiveCycle();
      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays);
      const container = document.getElementById('matrix-table-container');

      container.innerHTML = \`
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="matrix-print-hide">Weekend #</th>
              <th><span class="matrix-screen-only">Weekend Dates</span><span class="matrix-print-only">Date</span></th>
              <th><span class="matrix-screen-only">Assigned Personnel</span><span class="matrix-print-only">Member Name</span></th>
              <th class="matrix-print-hide">Role</th>
              <th class="matrix-print-hide">Attached Holiday</th>
              <th class="matrix-print-hide">Status</th>
            </tr>
          </thead>
          <tbody>
            \${weekends.map(w => {
              const workerId = cycle.assignments[w.saturday];
              const mem = window.appState.roster.find(m => m.id === workerId);
              const hol = w.attachedMonday || w.attachedFriday || '-';
              const printDate = formatWeekendPrintDate(w, cycle.assignments);
              const printName = getMemberPrintName(mem);
              return \`
                <tr>
                  <td class="matrix-print-hide">Weekend \${w.index + 1}</td>
                  <td>
                    <span class="matrix-screen-only">\${w.friday} &rarr; \${w.sunday}</span>
                    <span class="matrix-print-only">\${esc(printDate)}</span>
                  </td>
                  <td>
                    <span class="matrix-screen-only"><strong>\${mem ? esc(printName) : '<span style="color:var(--danger)">UNASSIGNED</span>'}</strong></span>
                    <span class="matrix-print-only">\${mem ? esc(printName) : 'UNASSIGNED'}</span>
                  </td>
                  <td class="matrix-print-hide"><span style="padding:2px 6px; border-radius:4px; font-weight:600; font-size:11px; background:\${mem?.role === 'FT' ? 'var(--color-accent-soft)' : 'var(--warning-soft)'}; color:\${mem?.role === 'FT' ? 'var(--info-text)' : 'var(--warning-border)'}">\${mem?.role || '-'}</span></td>
                  <td class="matrix-print-hide">\${hol}</td>
                  <td class="matrix-print-hide">\${mem ? '<span style="color:var(--success); font-weight:600;">&#10003; Staffed</span>' : '<span style="color:var(--danger); font-weight:600;">Action Required</span>'}</td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      \`;
    }

    // Render Shift Breakdown
    function renderBreakdown() {
      const cycle = getActiveCycle();
      if (!cycle) return;
      syncCycleAssignments(cycle.year);

      const container = document.getElementById('breakdown-table-container');
      const baseRoster = getCycleRoster();
      const roster = [...baseRoster];
      const assignedIds = new Set(Object.values(cycle.assignments || {}));
      assignedIds.forEach(id => {
        if (id && !roster.some(m => m.id === id)) {
          const found = window.appState.roster.find(m => m.id === id) ||
            (typeof HISTORICAL_MEMBERS !== 'undefined' ? HISTORICAL_MEMBERS.find(m => m.id === id) : null) ||
            { id, name: id.toUpperCase(), role: 'FT', color: '#64748b' };
          roster.push(found);
        }
      });

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const months = [];
      let mc = new Date(start.getFullYear(), start.getMonth(), 1);
      while (mc <= end) {
        months.push({ y: mc.getFullYear(), m: mc.getMonth() });
        mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
      }

      // Filter out any invalid observed holidays (e.g. July 4th observed)
      const cycleHolidays = (window.appState.holidays || []).filter(h => {
        return h.date >= cycle.startDate && h.date <= cycle.endDate && h.name !== 'Independence Day (Observed)' && !(h.date === '2027-07-05' && h.name.includes('Independence Day'));
      }).sort((a, b) => a.date.localeCompare(b.date));

      const stats = {};
      roster.forEach(m => {
        stats[m.id] = {
          total: 0,
          weekday: 0,
          sat: 0,
          sun: 0,
          hol: 0,
          holidaysWorked: [],
          months: months.map(() => 0)
        };
      });
      let unassigned = 0;
      let totalDays = 0;

      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        totalDays++;
        const dStr = formatDate(d);
        const id = cycle.assignments[dStr];
        if (!id || !stats[id]) { unassigned++; continue; }
        const s = stats[id];
        const dow = d.getDay();
        s.total++;
        if (dow === 6) s.sat++; else if (dow === 0) s.sun++; else s.weekday++;

        const hol = cycleHolidays.find(h => h.date === dStr);
        if (hol) {
          s.hol++;
          s.holidaysWorked.push({
            date: dStr,
            name: hol.name,
            dow: dayNames[dow]
          });
        }

        const mi = months.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth());
        if (mi >= 0) s.months[mi]++;
      }

      // Equity analysis segmented by role
      const fullFtMembers = roster.filter(m => m.role === 'FT' && (!m.activeEnd || m.activeEnd >= cycle.endDate) && (!m.activeStart || m.activeStart <= cycle.startDate));
      const partialMembers = roster.filter(m => (m.activeEnd && m.activeEnd < cycle.endDate) || (m.activeStart && m.activeStart > cycle.startDate));
      const altMembers = roster.filter(m => m.role === 'ALT');

      const ftTotals = fullFtMembers.map(m => stats[m.id].total);
      const ftMax = ftTotals.length ? Math.max(...ftTotals) : 0;
      const ftMin = ftTotals.length ? Math.min(...ftTotals) : 0;
      const ftAvg = ftTotals.length ? (ftTotals.reduce((a, b) => a + b, 0) / ftTotals.length) : 0;
      const ftSpread = ftMax - ftMin;
      const ftBalanced = ftSpread <= (cycle.blockType === 'FULL' ? 3 : 2);

      const altTotals = altMembers.map(m => stats[m.id].total);
      const altMax = altTotals.length ? Math.max(...altTotals) : 0;
      const altMin = altTotals.length ? Math.min(...altTotals) : 0;
      const altAvg = altTotals.length ? (altTotals.reduce((a, b) => a + b, 0) / altTotals.length) : 0;
      const altSpread = altMax - altMin;
      const altBalanced = altSpread <= 2;

      const allTotals = roster.map(m => stats[m.id].total);
      const maxOverall = allTotals.length ? Math.max(...allTotals) : 0;
      const isOverallBalanced = ftBalanced && altBalanced && unassigned === 0;

      container.innerHTML = \`
        <div style="margin-bottom:16px; padding:12px 16px; border-radius:8px; font-size:13px; background:\${isOverallBalanced ? 'var(--success-soft)' : 'var(--warning-soft)'}; color:\${isOverallBalanced ? 'var(--success-text)' : 'var(--warning-text)'}; border:1px solid \${isOverallBalanced ? 'var(--success-border)' : 'var(--warning-soft-border)'};">
          <div style="font-weight:700; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
            <span>\${isOverallBalanced ? '&#10003; Shifts are evenly distributed across all active investigators' : '&#9888; Shift Distribution Summary'}</span>
            \${unassigned > 0 ? \`<span style="background:var(--danger-soft); color:var(--danger-text); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">\${unassigned} Unassigned Days</span>\` : '<span style="background:var(--success-soft); color:var(--success-text); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">100% Fully Staffed</span>'}
          </div>
          <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:12px;">
            <div><strong>Full-Time (FT):</strong> Avg \${ftAvg.toFixed(1)} shifts &bull; Min: \${ftMin} &bull; Max: \${ftMax} &bull; Spread: \${ftSpread}</div>
            <div><strong>Alternates (ALT):</strong> Avg \${altAvg.toFixed(1)} shifts &bull; Min: \${altMin} &bull; Max: \${altMax} &bull; Spread: \${altSpread}</div>
            \${partialMembers.length ? \`<div><em>Note: \${partialMembers.map(p => esc(p.name) + ' partial tenure').join(', ')}</em></div>\` : ''}
          </div>
        </div>

        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:20px; border-radius:8px; border:1px solid var(--border-color);">
          <table class="breakdown-table" style="min-width:960px; margin:0;">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Total Shifts</th>
                <th>Weekday</th>
                <th>Saturday</th>
                <th>Sunday</th>
                <th style="min-width:180px;">Holidays Worked</th>
                <th>vs. Role Avg</th>
                \${months.map(x => \`<th>\${monthNames[x.m]}</th>\`).join('')}
              </tr>
            </thead>
            <tbody>
              \${roster.map(m => {
                const s = stats[m.id];
                const isFt = m.role === 'FT';
                const isPartial = partialMembers.some(p => p.id === m.id);
                const targetAvg = isFt ? ftAvg : altAvg;
                const diff = isPartial ? null : (s.total - targetAvg);
                const diffColor = diff === null ? 'var(--text-muted)' : (Math.abs(diff) <= 1.5 ? 'var(--success)' : 'var(--danger)');
                const diffStr = diff === null ? 'N/A' : ((diff > 0 ? '+' : '') + diff.toFixed(1));
                const w = maxOverall ? Math.round((s.total / maxOverall) * 70) : 0;
                return \`<tr>
                  <td><strong>\${esc(m.name)}</strong></td>
                  <td><span style="padding:2px 6px; border-radius:4px; font-weight:600; font-size:11px; background:\${m.role === 'FT' ? 'var(--color-accent-soft)' : 'var(--warning-soft)'}; color:\${m.role === 'FT' ? 'var(--info-text)' : 'var(--warning-border)'};">\${m.role}</span></td>
                  <td style="text-align:left;"><span class="bd-bar" style="width:\${w}px; background:\${m.color};"></span><strong>\${s.total}</strong></td>
                  <td>\${s.weekday}</td>
                  <td>\${s.sat}</td>
                  <td>\${s.sun}</td>
                  <td style="text-align:left;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:\${s.holidaysWorked.length ? '4px' : '0'};">
                      <strong>\${s.hol}</strong>
                      <span style="font-size:11px; color:var(--text-muted);">\${s.hol === 1 ? 'day' : 'days'}</span>
                    </div>
                    \${s.holidaysWorked.length > 0 ? \`
                      <div style="display:flex; flex-wrap:wrap; gap:3px;">
                        \${s.holidaysWorked.map(h => \`
                          <span style="font-size:10px; background:var(--warning-soft); color:var(--warning-text); padding:1px 5px; border-radius:3px; border:1px solid var(--warning-soft-border);" title="\${esc(h.name)} (\${h.dow}, \${h.date})">
                            \${esc(h.name)} <span style="opacity:0.75;">\${h.date.slice(5)}</span>
                          </span>
                        \`).join('')}
                      </div>
                    \` : '<span style="color:var(--text-muted); font-size:11px;">None</span>'}
                  </td>
                  <td style="color:\${diffColor}; font-weight:700;">\${diffStr}</td>
                  \${s.months.map(n => \`<td>\${n}</td>\`).join('')}
                </tr>\`;
              }).join('')}
              <tr class="totals">
                <td>Total</td>
                <td></td>
                <td>\${allTotals.reduce((a, b) => a + b, 0)}</td>
                <td>\${roster.reduce((a, m) => a + stats[m.id].weekday, 0)}</td>
                <td>\${roster.reduce((a, m) => a + stats[m.id].sat, 0)}</td>
                <td>\${roster.reduce((a, m) => a + stats[m.id].sun, 0)}</td>
                <td>\${roster.reduce((a, m) => a + stats[m.id].hol, 0)}</td>
                <td></td>
                \${months.map((x, i) => \`<td>\${roster.reduce((a, m) => a + stats[m.id].months[i], 0)}</td>\`).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Official Holidays Coverage Breakdown -->
        <div style="margin-top:24px; padding:20px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; box-shadow:var(--shadow-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:2px;">Official Holidays Coverage Breakdown</h3>
              <div style="font-size:12px; color:var(--text-muted);">List of members and holidays worked for active block (\${cycle.year} \${cycle.blockType === 'FULL' ? 'Full Year' : cycle.blockType}). July 4th is celebrated strictly on July 4th.</div>
            </div>
            <div style="font-size:12px; font-weight:600; background:var(--color-paper-2); padding:4px 10px; border-radius:6px;">
              \${cycleHolidays.length} Official Holidays in Block
            </div>
          </div>

          <!-- Member Holiday Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; margin-bottom:20px;">
            \${roster.map(m => {
              const s = stats[m.id];
              return \`
                <div style="border:1px solid var(--border-color); border-radius:8px; padding:12px 14px; background:var(--color-paper);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:\${m.color};"></span>
                      <strong style="font-size:13px;">\${esc(m.name)}</strong>
                      <span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:3px; background:\${m.role === 'FT' ? 'var(--color-accent-soft)' : 'var(--warning-soft)'}; color:\${m.role === 'FT' ? 'var(--info-text)' : 'var(--warning-border)'};">\${m.role}</span>
                    </div>
                    <span style="font-size:12px; font-weight:700; color:\${s.hol > 0 ? 'var(--primary)' : 'var(--text-muted)'};">
                      \${s.hol} \${s.hol === 1 ? 'Holiday' : 'Holidays'}
                    </span>
                  </div>
                  \${s.holidaysWorked.length > 0 ? \`
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      \${s.holidaysWorked.map(h => \`
                        <div style="font-size:11px; padding:4px 8px; border-radius:4px; background:var(--card-bg); border:1px solid var(--color-rule); display:flex; justify-content:space-between;">
                          <strong>\${esc(h.name)}</strong>
                          <span style="color:var(--text-muted); font-weight:600;">\${h.dow} \${h.date}</span>
                        </div>
                      \`).join('')}
                    </div>
                  \` : '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No holidays worked in this cycle</div>'}
                </div>
              \`;
            }).join('')}
          </div>

          <!-- Master Holiday Schedule Table -->
          <h4 style="font-size:14px; font-weight:700; margin-bottom:8px; color:var(--text-main);">Master Holiday Schedule</h4>
          <div style="overflow-x:auto;">
            <table class="breakdown-table" style="font-size:12px; min-width:600px;">
              <thead>
                <tr>
                  <th style="width:120px;">Holiday Date</th>
                  <th style="width:90px;">Day</th>
                  <th>Holiday Name</th>
                  <th>Assigned Investigator</th>
                  <th style="width:70px;">Role</th>
                  <th style="width:100px;">Status</th>
                </tr>
              </thead>
              <tbody>
                \${cycleHolidays.map(h => {
                  const workerId = cycle.assignments[h.date];
                  const worker = roster.find(m => m.id === workerId);
                  const dObj = parseDate(h.date);
                  const dowStr = dayNames[dObj.getDay()];
                  return \`
                    <tr>
                      <td><strong>\${h.date}</strong></td>
                      <td>\${dowStr}</td>
                      <td><strong>\${esc(h.name)}</strong></td>
                      <td>
                        \${worker ? \`
                          <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:\${worker.color};"></span>
                            <strong>\${esc(worker.name)}</strong>
                          </div>
                        \` : '<span style="color:var(--danger); font-weight:700;">UNASSIGNED</span>'}
                      </td>
                      <td>
                        \${worker ? \`<span style="font-size:10px; font-weight:700; padding:1px 5px; border-radius:3px; background:\${worker.role === 'FT' ? 'var(--color-accent-soft)' : 'var(--warning-soft)'}; color:\${worker.role === 'FT' ? 'var(--info-text)' : 'var(--warning-border)'};">\${worker.role}</span>\` : '-'}
                      </td>
                      <td>
                        \${worker ? '<span style="color:var(--success); font-weight:600;">&#10003; Assigned</span>' : '<span style="color:var(--danger); font-weight:600;">Action Required</span>'}
                      </td>
                    </tr>
                  \`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }

    // Tab view switching
    function showView(which) {
      const views = [
        [tabCalendarView, viewCalendarWrapper, 'calendar'],
        [tabMatrixView, viewMatrixWrapper, 'matrix'],
        [tabBreakdownView, viewBreakdownWrapper, 'breakdown']
      ];
      views.forEach(([tab, wrap, name]) => {
        tab.classList.toggle('active', name === which);
        wrap.style.display = name === which ? 'block' : 'none';
      });
      monthTabsBar.style.display = which === 'calendar' ? 'flex' : 'none';
      if (which === 'matrix') renderMatrix();
      if (which === 'breakdown') renderBreakdown();
    }
    tabCalendarView.addEventListener('click', () => showView('calendar'));
    tabMatrixView.addEventListener('click', () => showView('matrix'));
    tabBreakdownView.addEventListener('click', () => showView('breakdown'));
    // Auto-Generate Schedule
    document.getElementById('btn-solve').addEventListener('click', () => {
      storage.pushUndo();
      const cycle = getActiveCycle();
      const lockedShifts = {};

      if (cycle.blockType === 'FULL') {
        // Requirement 1: In FULL year, preserve all existing assignments already input
        // on H1, H2, or FULL unless cleared by the user
        Object.entries(cycle.assignments || {}).forEach(([d, memberId]) => {
          if (memberId) lockedShifts[d] = memberId;
        });
      } else {
        // In H1 or H2, preserve manual overrides
        Object.keys(cycle.manualOverrides || {}).forEach(d => {
          const memberId = cycle.assignments[d];
          if (memberId) lockedShifts[d] = memberId;
        });
      }

      // Requirement 2: When generating the second half (H2), look at the 1st half (H1)
      // to balance weekends, holidays, weekdays, and rest across the June/July boundary.
      // Similarly, when generating H1 or FULL, look at the prior year's H2 or FULL to
      // respect New Year's on-call coverage and post-weekend rest days across the year boundary.
      const context = {};
      if (cycle.blockType === 'H2') {
        const h1 = window.appState.cycles[\`\${cycle.year}-H1\`];
        if (h1 && h1.assignments && Object.keys(h1.assignments).length > 0) {
          context.priorAssignments = { ...h1.assignments };
        }
      } else if (cycle.blockType === 'H1' || cycle.blockType === 'FULL') {
        const prevYear = cycle.year - 1;
        const priorCycle = window.appState.cycles[\`\${prevYear}-H2\`] || window.appState.cycles[\`\${prevYear}-FULL\`];
        if (priorCycle && priorCycle.assignments && Object.keys(priorCycle.assignments).length > 0) {
          context.priorAssignments = { ...priorCycle.assignments };
        }
      }

      const result = solveSchedule(cycle, getCycleRoster(), window.appState.blackouts, window.appState.holidays, lockedShifts, window.appState.preferredWeekends, context);
      cycle.assignments = result.assignments;
      cycle.solverDiagnostics = result.diagnostics;
      cycle.updatedAt = Date.now();

      // Propagate assignments across sibling blocks
      if (cycle.blockType === 'H1' || cycle.blockType === 'H2') {
        const full = window.appState.cycles[\`\${cycle.year}-FULL\`];
        if (full) {
          if (!full.assignments) full.assignments = {};
          Object.assign(full.assignments, cycle.assignments);
        }
      } else if (cycle.blockType === 'FULL') {
        const h1 = window.appState.cycles[\`\${cycle.year}-H1\`];
        const h2 = window.appState.cycles[\`\${cycle.year}-H2\`];
        for (const [d, memId] of Object.entries(cycle.assignments)) {
          if (h1 && d >= h1.startDate && d <= h1.endDate) {
            if (!h1.assignments) h1.assignments = {};
            h1.assignments[d] = memId;
          }
          if (h2 && d >= h2.startDate && d <= h2.endDate) {
            if (!h2.assignments) h2.assignments = {};
            h2.assignments[d] = memId;
          }
        }
      }
      storage.saveState();
      renderApp();
      const notices = result.scheduleNotices || [];
      const prefWarn = result.preferenceWarnings || [];
      if (notices.length || prefWarn.length) {
        let msg = 'Schedule generated.';
        if (prefWarn.length) msg += '\\n\\nThese requested weekends could not be honored:\\n' + prefWarn.join('\\n');
        if (notices.length) msg += '\\n\\nNeeds your attention:\\n' + notices.join('\\n\\n');
        openScheduleAttentionModal(msg);
      } else {
        showToast('Schedule successfully generated! Requested weekends honored; all fatigue, rest, and quota rules applied.');
      }
    });

    let activeAttentionNotice = '';
    function openScheduleAttentionModal(msg) {
      activeAttentionNotice = msg;
      const contentEl = document.getElementById('attention-dialog-content');
      if (contentEl) contentEl.textContent = msg;
      closeAllModals();
      modalOverlay.classList.add('open');
      modalScheduleAttention.style.display = 'flex';
    }

    function updatePinnedNotesButton() {
      const btn = document.getElementById('btn-open-pinned');
      const countEl = document.getElementById('pinned-count');
      const notes = window.appState.pinnedNotes || [];
      if (!btn) return;
      if (notes.length > 0) {
        btn.style.display = 'inline-flex';
        if (countEl) countEl.textContent = notes.length;
      } else {
        btn.style.display = 'none';
      }
    }

    document.getElementById('btn-pin-active-notice').addEventListener('click', () => {
      if (!activeAttentionNotice) return;
      if (!window.appState.pinnedNotes) window.appState.pinnedNotes = [];
      const cycle = getActiveCycle();
      const cycleName = cycle ? (cycle.blockType === 'FULL' ? \`\${cycle.year} Full Year\` : \`\${cycle.year} \${cycle.blockType}\`) : '';
      window.appState.pinnedNotes.push({
        id: 'pin_' + Date.now(),
        cycleId: cycle ? cycle.id : '',
        cycleName,
        title: 'Attention Needed & Switch Suggestions',
        timestamp: new Date().toLocaleString(),
        content: activeAttentionNotice
      });
      storage.saveState();
      updatePinnedNotesButton();
      closeAllModals();
      showToast('Note and suggestions pinned to top menu bar.');
    });

    document.getElementById('btn-open-pinned').addEventListener('click', () => {
      closeAllModals();
      renderPinnedNotesModal();
      modalOverlay.classList.add('open');
      modalPinnedNotes.style.display = 'flex';
    });

    function renderPinnedNotesModal() {
      const listEl = document.getElementById('pinned-notes-list');
      const notes = window.appState.pinnedNotes || [];
      if (notes.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:24px;">No pinned notes or suggestions.</div>';
        return;
      }
      listEl.innerHTML = notes.map((item, idx) => \`
        <div style="background:var(--color-paper-2); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--color-rule); padding-bottom:8px;">
            <div style="font-weight:700; font-size:13px; color:var(--color-ink);">
              &#128204; \${esc(item.title || 'Pinned Note')} \${item.cycleName ? '(' + esc(item.cycleName) + ')' : ''}
              <span style="font-size:11px; font-weight:normal; color:var(--text-muted); margin-left:8px;">\${esc(item.timestamp || '')}</span>
            </div>
            <button class="btn btn-outline-dark btn-delete-single-pin" data-index="\${idx}" style="font-size:11px; padding:3px 8px; color:var(--danger); border-color:var(--danger-border);">&#128465; Delete</button>
          </div>
          <div style="white-space:pre-wrap; font-size:12.5px; line-height:1.6; color:var(--color-ink);">\${esc(item.content)}</div>
        </div>
      \`).join('');

      listEl.querySelectorAll('.btn-delete-single-pin').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          window.appState.pinnedNotes.splice(idx, 1);
          storage.saveState();
          updatePinnedNotesButton();
          if (window.appState.pinnedNotes.length === 0) {
            closeAllModals();
            showToast('Pinned notes cleared.');
          } else {
            renderPinnedNotesModal();
          }
        });
      });
    }

    document.getElementById('btn-clear-all-pinned').addEventListener('click', () => {
      if (!confirm('Clear all pinned notes and suggestions?')) return;
      window.appState.pinnedNotes = [];
      storage.saveState();
      updatePinnedNotesButton();
      closeAllModals();
      showToast('All pinned notes cleared.');
    });

    // Clear Calendar
    document.getElementById('btn-clear-calendar').addEventListener('click', () => {
      const cycle = getActiveCycle();
      if (!cycle) return;
      const cycleLabel = cycle.blockType === 'FULL'
        ? \`\${cycle.year} Full Year\`
        : \`\${cycle.year} \${cycle.blockType} (\${cycle.startDate} to \${cycle.endDate})\`;

      document.getElementById('clear-cycle-label').textContent = \`Clear Entire Calendar Block (\${cycleLabel})\`;

      // Populate month options
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthSelect = document.getElementById('clear-month-select');
      const monthOptions = [];
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (curr <= last) {
        const mIdx = curr.getMonth();
        const y = curr.getFullYear();
        monthOptions.push({
          val: \`\${y}-\${mIdx}\`,
          label: \`\${monthNames[mIdx]} \${y}\`,
          idx: mIdx,
          year: y
        });
        curr.setMonth(curr.getMonth() + 1);
      }
      monthSelect.innerHTML = monthOptions.map(opt => \`
        <option value="\${opt.val}">\${esc(opt.label)}</option>
      \`).join('');

      // Pre-select current month if single month view active
      if (activeMonthIdx !== -1) {
        const match = monthOptions.find(opt => opt.idx === activeMonthIdx);
        if (match) monthSelect.value = match.val;
        document.getElementById('clear-scope-month').checked = true;
      } else {
        document.getElementById('clear-scope-cycle').checked = true;
      }

      closeAllModals();
      modalOverlay.classList.add('open');
      modalClearCalendar.style.display = 'flex';
    });

    document.getElementById('btn-proceed-clear').addEventListener('click', () => {
      const cycle = getActiveCycle();
      if (!cycle) return;
      const isMonth = document.getElementById('clear-scope-month').checked;

      if (isMonth) {
        const monthSelect = document.getElementById('clear-month-select');
        const selectedVal = monthSelect.value;
        const [yStr, mStr] = selectedVal.split('-');
        const y = parseInt(yStr);
        const mIdx = parseInt(mStr);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthLabel = \`\${monthNames[mIdx]} \${y}\`;

        if (!confirm(\`Are you sure you want to clear all shift assignments for \${monthLabel}? This will wipe the schedule for this month.\`)) {
          return;
        }

        storage.clearMonth(y, mIdx, cycle.id);
        closeAllModals();
        renderApp();
        showToast(\`Cleared shifts for \${monthLabel}.\`);
      } else {
        const cycleLabel = cycle.blockType === 'FULL'
          ? \`\${cycle.year} Full Year\`
          : \`\${cycle.year} \${cycle.blockType} (\${cycle.startDate} to \${cycle.endDate})\`;

        if (!confirm(\`Are you sure you want to clear all shift assignments for "\${cycleLabel}"? This will wipe the entire calendar block.\`)) {
          return;
        }

        storage.clearCycle(cycle.id);
        closeAllModals();
        renderApp();
        showToast(\`Cleared all shifts for \${cycleLabel}.\`);
      }
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (storage.undo()) {
        renderApp();
        showToast('Undo performed.');
      }
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      if (storage.redo()) {
        renderApp();
        showToast('Redo performed.');
      }
    });

    // Cycle Change
    cycleSelect.addEventListener('change', (e) => {
      window.appState.activeCycleId = e.target.value;
      const c = getActiveCycle();
      syncCycleAssignments(c ? c.year : undefined);
      storage.saveState();
      const start = parseDate(c.startDate);
      activeMonthIdx = start.getMonth();
      renderApp();
    });

    // -------------------------------------------------------------

    // Guide and Rules Modals
    document.getElementById('btn-open-guide').addEventListener('click', () => {
      closeAllModals();
      modalGuide.style.display = 'flex';
      modalOverlay.classList.add('open');
    });

    document.getElementById('btn-open-rules').addEventListener('click', () => {
      closeAllModals();
      modalRules.style.display = 'flex';
      modalOverlay.classList.add('open');
    });

    // 1. Roster Manager Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-roster').addEventListener('click', () => {
      openRosterModal();
    });

    function openRosterModal() {
      const cycle = getActiveCycle();
      resetMemberForm();
      renderRosterList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalRoster.style.display = 'flex';
    }

    function renderRosterList() {
      const list = document.getElementById('roster-items-container');
      const cycle = getActiveCycle();
      const cycleRoster = getCycleRoster();
      const endedMembers = window.appState.roster.filter(m => !isMemberInCycle(m, cycle));

      document.getElementById('modal-roster-count').textContent = cycleRoster.length;
      document.getElementById('roster-count').textContent = cycleRoster.length;

      const weekdayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday' };

      let html = '';
      if (cycleRoster.length === 0) {
        html += '<div style="color:var(--text-muted); padding:16px; text-align:center;">No active investigators for this schedule block.</div>';
      } else {
        html += cycleRoster.map(m => \`
          <div class="item-card">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="width:16px; height:16px; border-radius:50%; background:\${m.color}; display:inline-block; flex-shrink:0;"></span>
              <div>
                <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                  \${esc(getMemberPrintName(m))}
                  <span style="font-size:11px; padding:2px 8px; border-radius:4px; font-weight:700; background:\${m.role === 'FT' ? 'var(--color-accent-soft)' : 'var(--warning-soft)'}; color:\${m.role === 'FT' ? 'var(--info-text)' : 'var(--warning-border)'}">\${m.role === 'FT' ? 'Full-Time (FT)' : 'Alternate (ALT)'}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                  Active: \${m.activeStart} \${m.activeEnd ? ('to ' + m.activeEnd) : '(Indefinite)'}
                  \${m.baselineWeekday ? (' &bull; Baseline: ' + weekdayNames[m.baselineWeekday]) : (m.role === 'FT' ? ' &bull; Rotational' : '')}
                  \${(!m.baselineWeekday && m.preferredWeekday) ? (' (prefers ' + weekdayNames[m.preferredWeekday] + ' if available)') : ''}
                  \${m.role === 'ALT' ? (' &bull; <strong>' + ((m.weekendsPerSixMonths !== undefined && m.weekendsPerSixMonths !== null) ? m.weekendsPerSixMonths : 3) + ' weekends / 6 mos</strong>') : ''}
                </div>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline-dark btn-edit-member" data-id="\${m.id}" style="color:var(--primary); border-color:var(--primary); padding:4px 10px; font-size:12px;">Edit</button>
              <button class="btn btn-outline-dark btn-remove-member" data-id="\${m.id}" style="color:var(--danger); border-color:var(--danger-border); padding:4px 10px; font-size:12px;">Remove</button>
            </div>
          </div>
        \`).join('');
      }

      if (endedMembers.length > 0) {
        html += \`
          <div style="margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-color);">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:600;">
              Ended / Past Members for this block (\${endedMembers.length} removed from active menu):
            </div>
            \${endedMembers.map(m => \`
              <div class="item-card" style="opacity:0.75; background:var(--color-paper); border:1px dashed var(--border-color);">
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--text-muted);">\${esc(m.name)} (\${m.role})</div>
                  <div style="font-size:11px; color:var(--danger);">End Date: \${m.activeEnd} (before block start \${cycle.startDate})</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-outline-dark btn-edit-member" data-id="\${m.id}" style="font-size:11px; padding:3px 8px;">Edit End Date</button>
                  <button class="btn btn-outline-dark btn-remove-member" data-id="\${m.id}" style="color:var(--danger); border-color:var(--danger-border); font-size:11px; padding:3px 8px;">Remove</button>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      }

      list.innerHTML = html;

      // Render Alternate Fire Marshal Weekends Per 6 Months block
      const altListEl = document.getElementById('alt-quota-controls-list');
      const altBlockEl = document.getElementById('alt-weekends-manager-block');
      const altMembersInRoster = window.appState.roster.filter(m => m.role === 'ALT');
      if (altBlockEl && altListEl) {
        if (altMembersInRoster.length === 0) {
          altBlockEl.style.display = 'none';
        } else {
          altBlockEl.style.display = 'block';
          const countCycle = getActiveCycle();
          const countWeekends = identifyWeekends(countCycle.startDate, countCycle.endDate, window.appState.holidays);
          const scheduledIn = (altId, half) => countWeekends.filter(w =>
            (countCycle.assignments || {})[w.saturday] === altId &&
            (half === null || (w.friday.slice(5) < '07-01') === (half === 'H1'))).length;
          const hasH1 = countWeekends.some(w => w.friday.slice(5) < '07-01');
          const hasH2 = countWeekends.some(w => w.friday.slice(5) >= '07-01');
          altListEl.innerHTML = altMembersInRoster.map(alt => {
            const total = scheduledIn(alt.id, null);
            const split = (hasH1 && hasH2)
              ? \`H1: \${scheduledIn(alt.id, 'H1')} &middot; H2: \${scheduledIn(alt.id, 'H2')}\`
              : '';
            const quotaVal = (alt.weekendsPerSixMonths !== undefined && alt.weekendsPerSixMonths !== null) ? alt.weekendsPerSixMonths : 3;
            return \`
              <div style="background:var(--card-bg); border:1px solid var(--warning-soft-border); border-radius:6px; padding:8px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <div style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:13px;">
                  <span style="width:10px; height:10px; border-radius:50%; background:\${alt.color}; display:inline-block;"></span>
                  <span>\${esc(alt.name)}</span>
                  <span title="Weekends scheduled for \${esc(alt.name)} in the selected block\${split ? ' (' + split.replace('&middot;', ',') + ')' : ''}" style="background:var(--warning-soft); color:var(--warning-text); border:1px solid var(--warning-soft-border); border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700;">\${total} scheduled\${split ? ' <span style="font-weight:600; opacity:0.8;">(' + split + ')</span>' : ''}</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="number" class="form-input alt-quick-quota-input" data-id="\${alt.id}" value="\${quotaVal}" min="0" max="26" style="width:64px; padding:4px 6px; text-align:center; font-weight:700;">
                  <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">/ 6 mos</span>
                </div>
              </div>
            \`;
          }).join('');

          altListEl.querySelectorAll('.alt-quick-quota-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
              const id = e.target.getAttribute('data-id');
              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
              e.target.value = val;
              const mem = window.appState.roster.find(m => m.id === id);
              if (mem) {
                mem.weekendsPerSixMonths = val;
                storage.saveState();
                renderRosterList();
                renderApp();
                showToast(\`\${mem.name} weekend quota updated to \${val} per 6 months. Re-run Auto-Generate to apply.\`);
              }
            });
          });
        }
      }

      list.querySelectorAll('.btn-edit-member').forEach(btn => {
        btn.addEventListener('click', () => startEditMember(btn.getAttribute('data-id')));
      });

      list.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const mem = window.appState.roster.find(m => m.id === id);
          if (confirm(\`Remove \${mem ? mem.name : 'this investigator'} from the roster?\`)) {
            window.appState.roster = window.appState.roster.filter(m => m.id !== id);
            storage.saveState();
            renderRosterList();
            renderApp();
            showToast('Investigator removed from roster.');
          }
        });
      });
    }

    // ---- Edit support ----
    let editingMemberId = null;

    function syncPrefDayVisibility() {
      const role = document.getElementById('member-role-input').value;
      const rotational = !document.getElementById('member-weekday-input').value && role === 'FT';
      document.getElementById('member-prefday-group').style.display = rotational ? 'block' : 'none';
      if (!rotational) document.getElementById('member-prefday-input').value = '';
      const altGroup = document.getElementById('member-alt-quota-group');
      if (altGroup) altGroup.style.display = role === 'ALT' ? 'block' : 'none';
    }
    document.getElementById('member-weekday-input').addEventListener('change', syncPrefDayVisibility);
    document.getElementById('member-role-input').addEventListener('change', syncPrefDayVisibility);

    function resetMemberForm() {
      editingMemberId = null;
      document.getElementById('member-rank-input').value = 'Trooper';
      document.getElementById('member-firstname-input').value = '';
      document.getElementById('member-name-input').value = '';
      document.getElementById('member-role-input').value = 'FT';
      document.getElementById('member-weekday-input').value = '';
      document.getElementById('member-prefday-input').value = '';
      document.getElementById('member-alt-quota-input').value = '3';
      document.getElementById('member-color-input').value = '#1e3a8a';
      document.getElementById('member-start-input').value = getActiveCycle().startDate;
      document.getElementById('member-end-input').value = '';
      document.getElementById('member-form-title').textContent = '+ Add Investigator to Roster';
      document.getElementById('btn-save-new-member').textContent = '+ Add Investigator to Active Roster';
      document.getElementById('btn-cancel-edit').style.display = 'none';
      syncPrefDayVisibility();
    }

    function startEditMember(id) {
      const m = window.appState.roster.find(x => x.id === id);
      if (!m) return;
      editingMemberId = id;
      document.getElementById('member-rank-input').value = m.rank || 'Trooper';
      document.getElementById('member-firstname-input').value = m.firstName || '';
      document.getElementById('member-name-input').value = m.name;
      document.getElementById('member-role-input').value = m.role;
      document.getElementById('member-weekday-input').value = m.baselineWeekday ? String(m.baselineWeekday) : '';
      document.getElementById('member-alt-quota-input').value = (m.weekendsPerSixMonths !== undefined && m.weekendsPerSixMonths !== null) ? String(m.weekendsPerSixMonths) : '3';
      syncPrefDayVisibility();
      document.getElementById('member-prefday-input').value = m.preferredWeekday ? String(m.preferredWeekday) : '';
      document.getElementById('member-color-input').value = m.color || '#1e3a8a';
      document.getElementById('member-start-input').value = m.activeStart || '';
      document.getElementById('member-end-input').value = m.activeEnd || '';
      document.getElementById('member-form-title').textContent = 'Editing ' + (m.rank ? m.rank + ' ' : '') + (m.firstName ? m.firstName + ' ' : '') + m.name;
      document.getElementById('btn-save-new-member').textContent = 'Save Changes';
      document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
      document.getElementById('member-name-input').focus();
    }

    document.getElementById('btn-cancel-edit').addEventListener('click', resetMemberForm);

    document.getElementById('btn-save-new-member').addEventListener('click', () => {
      const rank = document.getElementById('member-rank-input').value.trim() || 'Trooper';
      const firstName = document.getElementById('member-firstname-input').value.trim();
      const nameInput = document.getElementById('member-name-input');
      const name = nameInput.value.trim().toUpperCase();
      if (!name) {
        alert('Please enter the investigator\\'s last name.');
        return;
      }

      const role = document.getElementById('member-role-input').value;
      const weekdayVal = document.getElementById('member-weekday-input').value;
      const baselineWeekday = weekdayVal ? parseInt(weekdayVal) : null;
      const color = document.getElementById('member-color-input').value;
      const activeStart = document.getElementById('member-start-input').value || '2027-01-01';
      const activeEnd = document.getElementById('member-end-input').value || null;

      const prefVal = document.getElementById('member-prefday-input').value;
      const preferredWeekday = (!baselineWeekday && prefVal) ? parseInt(prefVal) : null;
      const rawAltQuota = parseInt(document.getElementById('member-alt-quota-input').value, 10);
      const weekendsPerSixMonths = role === 'ALT' ? (isNaN(rawAltQuota) ? 3 : Math.max(0, rawAltQuota)) : null;

      if (activeEnd && activeEnd < activeStart) {
        alert('Active end date must be on or after the start date.');
        return;
      }

      if (editingMemberId) {
        const m = window.appState.roster.find(x => x.id === editingMemberId);
        if (m) {
          Object.assign(m, { rank, firstName, name, role, activeStart, activeEnd, baselineWeekday, preferredWeekday, weekendsPerSixMonths, color });
        }
        storage.saveState();
        resetMemberForm();
        renderRosterList();
        renderApp();
        showToast(name + ' updated. Re-run Auto-Generate to apply changes.');
        return;
      }

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);

      window.appState.roster.push({
        preferredWeekday,
        weekendsPerSixMonths,
        id,
        rank,
        firstName,
        name,
        role,
        activeStart,
        activeEnd,
        baselineWeekday,
        color
      });

      storage.saveState();
      nameInput.value = '';
      document.getElementById('member-end-input').value = '';
      renderRosterList();
      renderApp();
      showToast(\`\${name} added to roster successfully.\`);
    });

    // -------------------------------------------------------------
    // 2. Blackouts & Leave Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-blackouts').addEventListener('click', () => {
      openBlackoutsModal();
    });

    // Helper: Get blackouts for the currently selected cycle
    // In H1/H2, show only blackouts overlapping that portion; in FULL, show all
    // Arranged in chronological order by date
    function cycleBlackouts() {
      const c = getActiveCycle();
      let list = window.appState.blackouts;
      if (c && c.blockType !== 'FULL') {
        list = list.filter(b => b.startDate <= c.endDate && b.endDate >= c.startDate);
      }
      return list.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (a.endDate || '').localeCompare(b.endDate || '') || (a.memberId || '').localeCompare(b.memberId || ''));
    }

    function openBlackoutsModal() {
      const select = document.getElementById('book-member-select');
      const cycleRoster = getCycleRoster();
      select.innerHTML = cycleRoster.map(m => \`
        <option value="\${m.id}">\${esc(m.name)} (\${m.role})</option>
      \`).join('');

      const cycle = getActiveCycle();
      document.getElementById('book-start-input').value = cycle.startDate;
      document.getElementById('book-end-input').value = cycle.startDate;

      renderBlackoutsList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalBlackouts.style.display = 'flex';
    }

    function renderBlackoutsList() {
      const list = document.getElementById('blackouts-items-container');
      const blackouts = cycleBlackouts();
      document.getElementById('modal-blackouts-count').textContent = blackouts.length;
      document.getElementById('blackout-count').textContent = blackouts.length;

      if (blackouts.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center;">No blackout ranges booked for this schedule block.</div>';
        return;
      }

      list.innerHTML = blackouts.map(b => {
        const mem = window.appState.roster.find(m => m.id === b.memberId);
        return \`
          <div class="item-card">
            <div>
              <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px;">
                \${mem?.color ? ('<span style="width:10px; height:10px; border-radius:50%; background:' + mem.color + ';"></span>') : ''}
                \${esc(mem?.name || b.memberId)}
                <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">\${b.notes ? ('(' + esc(b.notes) + ')') : ''}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                \${b.startDate} &rarr; \${b.endDate}
              </div>
            </div>
            <button class="btn btn-outline-dark btn-delete-blackout" data-id="\${b.id}" style="color:var(--danger); border-color:var(--danger-border); padding:4px 8px; font-size:11px;">Delete</button>
          </div>
        \`;
      }).join('');

      list.querySelectorAll('.btn-delete-blackout').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          window.appState.blackouts = window.appState.blackouts.filter(b => b.id !== id);
          storage.saveState();
          renderBlackoutsList();
          renderApp();
          showToast('Blackout range removed.');
        });
      });
    }

    document.getElementById('btn-save-new-blackout').addEventListener('click', () => {
      const memberId = document.getElementById('book-member-select').value;
      const startDate = document.getElementById('book-start-input').value;
      const endDate = document.getElementById('book-end-input').value;
      const notes = document.getElementById('book-notes-input').value.trim();

      if (!memberId) {
        alert('Please select an investigator.');
        return;
      }
      if (!startDate || !endDate) {
        alert('Please choose both start and end dates.');
        return;
      }
      if (startDate > endDate) {
        alert('Start date must be before or equal to end date.');
        return;
      }

      window.appState.blackouts.push({
        id: \`b_\${Date.now()}\`,
        memberId,
        startDate,
        endDate,
        notes: notes || 'Vacation / Leave'
      });

      storage.saveState();
      renderBlackoutsList();
      renderApp();
      document.getElementById('book-notes-input').value = '';
      showToast('Blackout booked successfully.');
    });

    // -------------------------------------------------------------
    // 2b. Requested Weekends Handlers
    // -------------------------------------------------------------
    // Helper: Get requested weekends for the currently selected cycle
    // In H1/H2, show only requests for that portion; in FULL, show all
    function cyclePrefs() {
      const c = getActiveCycle();
      if (!c || c.blockType === 'FULL') {
        return window.appState.preferredWeekends;
      }
      return window.appState.preferredWeekends.filter(p => p.weekendFriday >= c.startDate && p.weekendFriday <= c.endDate);
    }

    document.getElementById('btn-open-prefs').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const cycleRoster = getCycleRoster();
      refreshPrefWeekendSelect();
      renderPrefsList();
      closeAllModals();
      modalOverlay.classList.add('open');
      modalPrefs.style.display = 'flex';
    });

    // Investigator dropdown: alternates show how many weekends they are scheduled
    // for in this block, plus how many requests are waiting for the next Auto-Generate.
    function refreshPrefMemberSelect() {
      const cycle = getActiveCycle();
      const select = document.getElementById('pref-member-select');
      const previous = select.value;
      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays);
      const prefs = cyclePrefs();
      select.innerHTML = getCycleRoster().map(m => {
        let label = \`\${esc(m.name)} (\${m.role})\`;
        if (m.role === 'ALT') {
          const scheduled = weekends.filter(w => (cycle.assignments || {})[w.saturday] === m.id).length;
          const requested = prefs.filter(p => p.memberId === m.id).length;
          label += \` \u2014 \${scheduled} scheduled\${requested ? ', ' + requested + ' requested' : ''}\`;
        }
        return \`<option value="\${m.id}">\${label}</option>\`;
      }).join('');
      if (previous && Array.from(select.options).some(o => o.value === previous)) select.value = previous;
    }

    // Weekend dropdown lists only weekends nobody has requested yet, so a weekend
    // can never be requested twice. Re-run after every add/delete.
    function refreshPrefWeekendSelect() {
      refreshPrefMemberSelect();
      const cycle = getActiveCycle();
      const select = document.getElementById('pref-weekend-select');
      const addBtn = document.getElementById('btn-save-new-pref');
      const previous = select.value;
      const taken = new Set(window.appState.preferredWeekends.map(p => p.weekendFriday));
      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays)
        .filter(w => !taken.has(w.friday));
      if (weekends.length === 0) {
        select.innerHTML = '<option value="">All weekends in this block are already requested</option>';
        addBtn.disabled = true;
        return;
      }
      addBtn.disabled = false;
      select.innerHTML = weekends.map(w => {
        const hol = w.attachedMonday ? ' + Mon holiday' : (w.attachedFriday ? ' + Fri holiday' : '');
        return \`<option value="\${w.friday}">Fri \${w.friday} to Sun \${w.sunday}\${hol}</option>\`;
      }).join('');
      if (weekends.some(w => w.friday === previous)) select.value = previous;
    }

    function renderPrefsList() {
      refreshPrefWeekendSelect();
      const list = document.getElementById('pref-items-container');
      const prefs = cyclePrefs().sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday));
      document.getElementById('modal-pref-count').textContent = prefs.length;
      document.getElementById('pref-count').textContent = prefs.length;
      if (prefs.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center;">No requested weekends for this block.</div>';
        return;
      }
      list.innerHTML = prefs.map(p => {
        const mem = window.appState.roster.find(m => m.id === p.memberId);
        return \`
          <div class="item-card">
            <div>
              <div style="font-weight:700; font-size:13px;">&#11088; \${esc(mem ? mem.name : p.memberId)}
                <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">\${p.notes ? ('(' + esc(p.notes) + ')') : ''}</span></div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Weekend starting Fri \${p.weekendFriday}</div>
            </div>
            <button class="btn btn-outline-dark btn-delete-pref" data-id="\${p.id}" style="color:var(--danger); border-color:var(--danger-border); padding:4px 8px; font-size:11px;">Delete</button>
          </div>\`;
      }).join('');

      list.querySelectorAll('.btn-delete-pref').forEach(btn => {
        btn.addEventListener('click', () => {
          window.appState.preferredWeekends = window.appState.preferredWeekends.filter(p => p.id !== btn.getAttribute('data-id'));
          storage.saveState();
          renderPrefsList();
          renderApp();
          showToast('Requested weekend removed. Re-run Auto-Generate to apply.');
        });
      });
    }

    document.getElementById('btn-save-new-pref').addEventListener('click', () => {
      const memberId = document.getElementById('pref-member-select').value;
      const weekendFriday = document.getElementById('pref-weekend-select').value;
      const notes = document.getElementById('pref-notes-input').value.trim();
      if (!memberId || !weekendFriday) { alert('Choose an investigator and a weekend.'); return; }
      if (window.appState.preferredWeekends.some(p => p.weekendFriday === weekendFriday)) {
        alert('That weekend has already been requested.');
        refreshPrefWeekendSelect();
        return;
      }
      window.appState.preferredWeekends.push({ id: \`p_\${Date.now()}\`, memberId, weekendFriday, notes });
      storage.saveState();
      document.getElementById('pref-notes-input').value = '';
      renderPrefsList();
      renderApp();
      showToast('Requested weekend added. Click Auto-Generate Schedule to apply.');
    });

    // -------------------------------------------------------------
    // 3. Add Year / Schedule Block Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-add-cycle').addEventListener('click', () => {
      const currentCycle = getActiveCycle();
      document.getElementById('new-cycle-year').value = currentCycle ? (currentCycle.year + 1) : 2028;
      closeAllModals();
      modalOverlay.classList.add('open');
      modalAddCycle.style.display = 'flex';
    });

    document.getElementById('btn-confirm-add-cycle').addEventListener('click', () => {
      const year = parseInt(document.getElementById('new-cycle-year').value);
      const blockType = document.getElementById('new-cycle-block').value;
      const carryRoster = document.getElementById('new-cycle-carry-roster').checked;

      if (!year || year < 2020 || year > 2060) {
        alert('Please enter a valid 4-digit calendar year.');
        return;
      }

      const cycleId = \`\${year}-\${blockType}\`;

      if (window.appState.cycles[cycleId]) {
        if (!confirm(\`Schedule block "\${cycleId}" already exists. Overwrite it?\`)) {
          return;
        }
      }

      let startDate = \`\${year}-01-01\`;
      let endDate = \`\${year}-12-31\`;
      if (blockType === 'H1') {
        startDate = \`\${year}-01-01\`;
        endDate = \`\${year}-06-30\`;
      } else if (blockType === 'H2') {
        startDate = \`\${year}-07-01\`;
        endDate = \`\${year}-12-31\`;
      }

      // Generate holidays for the year and merge
      const generatedHols = generateOfficialPSPHolidays(year);
      const existingHolDates = new Set(window.appState.holidays.map(h => h.date));
      generatedHols.forEach(h => {
        if (!existingHolDates.has(h.date)) {
          window.appState.holidays.push(h);
        }
      });

      // Create new cycle entry
      window.appState.cycles[cycleId] = {
        id: cycleId,
        year,
        blockType,
        startDate,
        endDate,
        rosterSnapshot: carryRoster ? clone(window.appState.roster) : [],
        blackoutsSnapshot: [],
        assignments: {},
        manualOverrides: {},
        solverDiagnostics: {},
        updatedAt: Date.now()
      };

      // Set as active
      window.appState.activeCycleId = cycleId;
      storage.saveState();

      activeMonthIdx = blockType === 'H2' ? 6 : 0;
      closeAllModals();
      renderApp();
      showToast(\`Schedule block "\${cycleId}" created successfully! Click "Auto-Generate Schedule" to staff.\`);
    });

    // -------------------------------------------------------------
    // 4. Shift Reassign Handlers
    // -------------------------------------------------------------
    function checkManualAssignmentRuleViolations(dateStr, memberId) {
      if (!memberId) return [];
      const cycle = getActiveCycle();
      const mem = window.appState.roster.find(m => m.id === memberId);
      if (!mem) return [];
      const violations = [];

      // 1. Blackout Check
      const dayBlackout = window.appState.blackouts.find(b => b.memberId === memberId && dateStr >= b.startDate && dateStr <= b.endDate);
      if (dayBlackout) {
        violations.push({
          type: 'BLACKOUT',
          severity: 'ERROR',
          message: \`Blackout Conflict: \${mem.name} is on booked leave (\${dayBlackout.notes || \`\${dayBlackout.startDate} to \${dayBlackout.endDate}\`}).\`
        });
      }

      // 2. Post-Weekend Rest / Days Off (Spec §4: Thursday through Sunday)
      // Anyone who worked the prior weekend cannot work Wed (rest), Thu-Sun (scheduled on days off)
      const d = parseDate(dateStr);
      const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      if (dow === 3 || dow === 4 || dow === 5 || dow === 6 || dow === 0) {
        const daysBack = (dow === 0) ? 9 : (dow + 2); // days back to preceding Friday
        const prevFri = formatDate(addDays(d, -daysBack));
        const prevSat = formatDate(addDays(d, -daysBack + 1));
        const prevSun = formatDate(addDays(d, -daysBack + 2));
        const prevWorker = cycle.assignments[prevSat] || cycle.assignments[prevFri] || cycle.assignments[prevSun];
        if (prevWorker === memberId) {
          const daysOffDesc = dow === 3 ? 'post-weekend rest' : 'days off (Thursday–Sunday)';
          violations.push({
            type: 'POST_WEEKEND_REST',
            severity: 'ERROR',
            message: \`Post-Weekend Days Off: \${mem.name} worked the prior weekend (\${prevFri}) and cannot work \${dateStr} (scheduled on \${daysOffDesc}).\`
          });
        }
      }

      // 3. Consecutive Weekend Rule (if dateStr is on a weekend)
      if (dow === 5 || dow === 6 || dow === 0) {
        const daysForward = (dow === 5 ? 7 : (dow === 6 ? 6 : 5));
        const nextFri = formatDate(addDays(d, daysForward));
        const nextSat = formatDate(addDays(d, daysForward + 1));
        if (cycle.assignments[nextSat] === memberId || cycle.assignments[nextFri] === memberId) {
          violations.push({
            type: 'CONSECUTIVE_WEEKEND',
            severity: 'WARNING',
            message: \`Consecutive Weekend: \${mem.name} is already assigned to the following weekend (\${nextFri}).\`
          });
        }
      }

      // 4. Alternate Mid-Week
      if (mem.role === 'ALT' && dow >= 1 && dow <= 4) {
        const holiday = window.appState.holidays.find(h => h.date === dateStr);
        const isAttachedMon = holiday && holiday.type === 'attached_mon';
        if (!isAttachedMon) {
          violations.push({
            type: 'ALT_WEEKDAY',
            severity: 'WARNING',
            message: \`Administrative Exemption: Alternate \${mem.name} assigned to mid-week shift.\`
          });
        }
      }

      return violations;
    }

    function openReassignModal(dateStr) {
      selectedDateForReassign = dateStr;
      const cycle = getActiveCycle();
      const currentAssigned = cycle.assignments[dateStr];

      document.getElementById('reassign-date-title').textContent = \`Duty Assignment: \${dateStr}\`;
      const select = document.getElementById('reassign-member-select');
      
      const availableMembers = window.appState.roster.filter(m => {
        if (m.activeStart && dateStr < m.activeStart) return false;
        if (m.activeEnd && dateStr > m.activeEnd) return false;
        return true;
      });

      select.innerHTML = '<option value="">-- UNASSIGNED --</option>' +
        availableMembers.map(m => \`
          <option value="\${m.id}" \${m.id === currentAssigned ? 'selected' : ''}>
            \${esc(m.name)} (\${m.role})
          </option>
        \`).join('');

      function updatePreview() {
        const preview = document.getElementById('reassign-conflict-preview');
        const selectedId = select.value;
        if (!selectedId) {
          preview.innerHTML = '<span style="color:var(--text-muted)">Shift will be marked Unassigned.</span>';
          return;
        }
        const mem = window.appState.roster.find(m => m.id === selectedId);
        const violations = checkManualAssignmentRuleViolations(dateStr, selectedId);
        if (violations.length > 0) {
          preview.innerHTML = violations.map(v => \`
            <div style="color:\${v.severity === 'ERROR' ? 'var(--danger)' : 'var(--warning)'}; font-weight:700; margin-top:4px;">
              &#9888; \${esc(v.message)}
            </div>
          \`).join('');
        } else {
          preview.innerHTML = \`<span style="color:var(--success); font-weight:600;">&#10003; No rule conflicts for \${esc(mem?.name)}.</span>\`;
        }
      }

      select.onchange = updatePreview;
      select.oninput = updatePreview;
      select.onkeyup = updatePreview;
      updatePreview();

      closeAllModals();
      modalOverlay.classList.add('open');
      modalReassign.style.display = 'flex';
      setTimeout(() => {
        select.focus();
      }, 0);
    }

    function formatWkShort(wk) {
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const f = parseDate(wk.friday);
      const e = parseDate(wk.attachedMonday || wk.sunday);
      const mf = MONTHS[f.getMonth()];
      const me = MONTHS[e.getMonth()];
      return mf === me ? \`\${mf} \${f.getDate()}–\${e.getDate()}\` : \`\${mf} \${f.getDate()} – \${me} \${e.getDate()}\`;
    }

    function checkAndConfirmAltQuota(proposedDates, memberId, cycle) {
      if (!memberId) return true;
      const mem = window.appState.roster.find(m => m.id === memberId);
      if (!mem || mem.role !== 'ALT') return true;

      const rawQuota = (mem.weekendsPerSixMonths !== undefined && mem.weekendsPerSixMonths !== null)
        ? parseInt(mem.weekendsPerSixMonths, 10)
        : 3;
      const baseQuota = isNaN(rawQuota) ? 3 : Math.max(0, rawQuota);
      const targetQuota = cycle.blockType === 'FULL' ? (baseQuota * 2) : baseQuota;

      const weekends = identifyWeekends(cycle.startDate, cycle.endDate, window.appState.holidays || []);
      const testAssignments = { ...(cycle.assignments || {}) };
      proposedDates.forEach(d => { testAssignments[d] = memberId; });

      const currentWeekends = weekends.filter(w => {
        return (cycle.assignments || {})[w.friday] === memberId ||
               (cycle.assignments || {})[w.saturday] === memberId ||
               (cycle.assignments || {})[w.sunday] === memberId ||
               (w.attachedMonday && (cycle.assignments || {})[w.attachedMonday] === memberId);
      });

      const proposedWeekends = weekends.filter(w => {
        return testAssignments[w.friday] === memberId ||
               testAssignments[w.saturday] === memberId ||
               testAssignments[w.sunday] === memberId ||
               (w.attachedMonday && testAssignments[w.attachedMonday] === memberId);
      });

      if (proposedWeekends.length > targetQuota && proposedWeekends.length > currentWeekends.length) {
        const memDisplayName = getMemberPrintName(mem);
        const confirmMsg =
          \`Alternate Fire Marshal Quota Exceeded:\\n\\n\` +
          \`\${memDisplayName} has a configured roster quota of \${targetQuota} weekend\${targetQuota === 1 ? '' : 's'}.\\n\` +
          \`Assigning this shift will result in \${proposedWeekends.length} scheduled weekends for this period.\\n\\n\` +
          \`Would you like to confirm this assignment and automatically pin a note for all scheduled weekends?\`;

        if (!confirm(confirmMsg)) {
          return false;
        }

        // Automatically add a pinned note on all of the scheduled weekends for that alternate
        const cycleName = cycle ? (cycle.blockType === 'FULL' ? \`\${cycle.year} Full Year\` : \`\${cycle.year} \${cycle.blockType}\`) : '';
        const weekendLines = proposedWeekends.map((w, idx) => {
          const dateRange = \`\${w.friday} to \${w.attachedMonday || w.sunday}\`;
          return \`• Weekend \${idx + 1}: \${formatWkShort(w)} (\${dateRange})\`;
        }).join('\\n');

        const noteContent =
          \`\${memDisplayName} (Alternate Fire Marshal) has been manually assigned to \${proposedWeekends.length} weekends in \${cycleName}, exceeding the roster quota of \${targetQuota} weekend\${targetQuota === 1 ? '' : 's'}.\\n\\n\` +
          \`All Scheduled Weekends (\${proposedWeekends.length} total):\\n\` +
          weekendLines;

        if (!window.appState.pinnedNotes) window.appState.pinnedNotes = [];
        window.appState.pinnedNotes = window.appState.pinnedNotes.filter(
          p => !(p.cycleId === cycle.id && p.memberId === memberId && p.type === 'ALT_QUOTA_EXCEEDED')
        );

        window.appState.pinnedNotes.push({
          id: 'pin_' + Date.now(),
          cycleId: cycle ? cycle.id : '',
          cycleName,
          memberId,
          type: 'ALT_QUOTA_EXCEEDED',
          title: \`Alternate Quota Exceeded: \${memDisplayName}\`,
          timestamp: new Date().toLocaleString(),
          content: noteContent
        });

        updatePinnedNotesButton();
      }

      return true;
    }

    document.getElementById('btn-save-shift').addEventListener('click', () => {
      if (!selectedDateForReassign) return;
      const newMemberId = document.getElementById('reassign-member-select').value;
      const cycle = getActiveCycle();
      const currentAssigned = cycle.assignments[selectedDateForReassign];

      if (newMemberId) {
        const violations = checkManualAssignmentRuleViolations(selectedDateForReassign, newMemberId);
        const blockingViolations = violations.filter(v => v.severity === 'ERROR' || v.type === 'CONSECUTIVE_WEEKEND');
        if (blockingViolations.length > 0) {
          const mem = window.appState.roster.find(m => m.id === newMemberId);
          const name = mem ? (getMemberPrintName(mem) || mem.name) : 'this investigator';
          const details = blockingViolations.map(v => \`• \${v.message}\`).join('\\n');
          if (!confirm(\`Rule Violation Notification:\\n\\n\${details}\\n\\nDo you want to manually overwrite this rule and assign \${name}?\`)) {
            return;
          }
        }
      }

      // Check if clicked date is Friday and member was changed or added to unscheduled day
      const d = parseDate(selectedDateForReassign);
      const isFriday = d.getDay() === 5;
      const isChangingOrAdding = Boolean(newMemberId && (!currentAssigned || currentAssigned !== newMemberId));

      if (isFriday && isChangingOrAdding) {
        const mem = window.appState.roster.find(m => m.id === newMemberId);
        const memDisplayName = getMemberPrintName(mem);
        if (confirm(\`Would you like to fill the weekend with '\${memDisplayName}'?\`)) {
          const sat = formatDate(addDays(d, 1));
          const sun = formatDate(addDays(d, 2));
          const mon = formatDate(addDays(d, 3));
          const holidays = window.appState.holidays || [];
          const attachedMon = holidays.find(h => h.date === mon && h.type === 'attached_mon');
          const weekendDays = [selectedDateForReassign, sat, sun];
          if (attachedMon) weekendDays.push(mon);

          let weekendViolations = [];
          weekendDays.slice(1).forEach(dStr => {
            const viols = checkManualAssignmentRuleViolations(dStr, newMemberId);
            const blocking = viols.filter(v => v.severity === 'ERROR' || v.type === 'CONSECUTIVE_WEEKEND');
            if (blocking.length > 0) {
              weekendViolations.push(...blocking);
            }
          });

          if (weekendViolations.length > 0) {
            const details = weekendViolations.map(v => \`• \${v.message}\`).join('\\n');
            if (!confirm(\`Rule Violation Notification for weekend dates:\\n\\n\${details}\\n\\nDo you want to manually overwrite these rules and assign \${memDisplayName} to the rest of the weekend?\`)) {
              return;
            }
          }

          // Check Alternate quota prior to filling
          if (!checkAndConfirmAltQuota(weekendDays, newMemberId, cycle)) {
            return;
          }

          storage.pushUndo();
          weekendDays.forEach(dStr => {
            cycle.assignments[dStr] = newMemberId;
            cycle.manualOverrides[dStr] = true;
            syncShiftToSiblings(dStr, newMemberId);
          });
          cycle.updatedAt = Date.now();
          storage.saveState();
          closeAllModals();
          renderApp();
          showToast(\`Weekend (\${selectedDateForReassign} to \${weekendDays[weekendDays.length - 1]}) assigned to \${memDisplayName}.\`);
          return;
        }
      }

      // Check Alternate quota prior to filling single date
      if (newMemberId && !checkAndConfirmAltQuota([selectedDateForReassign], newMemberId, cycle)) {
        return;
      }

      storage.pushUndo();
      if (newMemberId) {
        cycle.assignments[selectedDateForReassign] = newMemberId;
        cycle.manualOverrides[selectedDateForReassign] = true;
      } else {
        delete cycle.assignments[selectedDateForReassign];
        delete cycle.manualOverrides[selectedDateForReassign];
      }
      cycle.updatedAt = Date.now();
      syncShiftToSiblings(selectedDateForReassign, newMemberId);
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Shift for \${selectedDateForReassign} updated.\`);
    });

    document.getElementById('btn-clear-shift').addEventListener('click', () => {
      if (!selectedDateForReassign) return;
      storage.pushUndo();
      const cycle = getActiveCycle();
      delete cycle.assignments[selectedDateForReassign];
      delete cycle.manualOverrides[selectedDateForReassign];
      cycle.updatedAt = Date.now();
      syncShiftToSiblings(selectedDateForReassign, null);
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Shift for \${selectedDateForReassign} cleared.\`);
    });

    // -------------------------------------------------------------
    // 5. Import Handlers
    // -------------------------------------------------------------
    document.getElementById('btn-open-import').addEventListener('click', () => {
      closeAllModals();
      modalOverlay.classList.add('open');
      modalImport.style.display = 'flex';
    });

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', handleFile);

    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files.length) handleFile({ target: { files: e.dataTransfer.files } });
    });

    function handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      const isCsv = file.name.endsWith('.csv');

      reader.onload = function(evt) {
        const data = evt.target.result;
        const result = parseSpreadsheet(window.XLSX, data, isCsv);
        pendingImportShifts = result.parsedShifts;

        // Check for unmatched names
        const activeNames = new Set(window.appState.roster.map(m => m.name));
        const unmatched = result.rawNames.filter(n => !activeNames.has(n));

        if (unmatched.length > 0) {
          openAliasModal(unmatched);
        } else {
          commitImport({});
        }
      };

      if (isCsv) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    }

    function openAliasModal(unmatched) {
      const list = document.getElementById('alias-mapping-list');
      const allRosterAndHistorical = [...window.appState.roster, ...HISTORICAL_MEMBERS];

      list.innerHTML = unmatched.map(alias => \`
        <div style="margin-bottom:14px; background:var(--color-paper); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
          <div style="font-weight:700; margin-bottom:6px;">Unmatched Alias: <span style="color:var(--danger)">\${esc(alias)}</span></div>
          <select class="form-select alias-select" data-alias="\${esc(alias)}">
            <option value="">-- Leave Unassigned --</option>
            \${allRosterAndHistorical.map(m => \`<option value="\${m.id}">Map to \${esc(m.name)} (\${m.role})</option>\`).join('')}
            <option value="__NEW_INACTIVE__">+ Create as Historical Inactive Member</option>
          </select>
        </div>
      \`).join('');

      closeAllModals();
      modalOverlay.classList.add('open');
      modalAlias.style.display = 'flex';
    }

    document.getElementById('btn-confirm-alias').addEventListener('click', () => {
      const aliasMap = {};
      modalAlias.querySelectorAll('.alias-select').forEach(sel => {
        const alias = sel.getAttribute('data-alias');
        const val = sel.value;
        if (val === '__NEW_INACTIVE__') {
          const newId = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          window.appState.roster.push({
            id: newId,
            name: alias,
            role: 'FT',
            activeStart: '2026-01-01',
            activeEnd: '2027-01-01',
            color: '#64748b'
          });
          aliasMap[alias] = newId;
        } else if (val) {
          aliasMap[alias] = val;
        }
      });

      closeAllModals();
      commitImport(aliasMap);
    });

    function commitImport(aliasMap) {
      if (!pendingImportShifts) return;
      storage.pushUndo();
      const cycle = getActiveCycle();

      pendingImportShifts.forEach(({ dateStr, rawName }) => {
        if (!rawName) return;
        let member = window.appState.roster.find(m => m.name === rawName);
        const memId = member ? member.id : aliasMap[rawName];
        if (memId) {
          cycle.assignments[dateStr] = memId;
          syncShiftToSiblings(dateStr, memId);
        }
      });

      cycle.updatedAt = Date.now();
      storage.saveState();
      closeAllModals();
      renderApp();
      showToast(\`Import complete! \${pendingImportShifts.length} shifts loaded.\`);
      pendingImportShifts = null;
    }

    // Export to Excel
    document.getElementById('btn-export-excel').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const wb = generateExcelWorkbook(window.XLSX, cycle, window.appState.roster, cycle.assignments);
      window.XLSX.writeFile(wb, \`\${cycle.year}_\${cycle.blockType}_Fire_Marshal_OnCall_Schedule.xlsx\`);
      showToast('Excel workbook exported.');
    });

    // Print
    // Print All Months: render every month of the cycle, then print once
    document.getElementById('btn-print-all').addEventListener('click', () => {
      const cycle = getActiveCycle();
      const savedIdx = activeMonthIdx;
      const start = parseDate(cycle.startDate);
      const end = parseDate(cycle.endDate);
      const printContainer = document.getElementById('print-all-container');
      printContainer.innerHTML = '';
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      while (curr <= end) {
        activeMonthIdx = curr.getMonth();
        renderCalendar();
        const clone = viewCalendarWrapper.querySelector('.calendar-container').cloneNode(true);
        printContainer.appendChild(clone);
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      activeMonthIdx = savedIdx;
      renderCalendar();
      document.body.classList.add('printing-all');
      const cleanup = () => {
        document.body.classList.remove('printing-all');
        printContainer.innerHTML = '';
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
    });

    document.getElementById('btn-print').addEventListener('click', () => {
      window.print();
    });

    // Suppress browser title/timestamp in print header
    window.addEventListener('beforeprint', () => {
      window._savedDocTitle = document.title;
      document.title = '';
    });
    window.addEventListener('afterprint', () => {
      document.title = window._savedDocTitle || 'PSP Fire Marshal On-Call Schedule Generator';
    });

    // -------------------------------------------------------------
    // Backup / Restore (JSON)
    // -------------------------------------------------------------
    document.getElementById('btn-backup-export').addEventListener('click', () => {
      const json = storage.exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'PSP_FireMarshal_Backup_' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup downloaded: ' + a.download);
    });

    const backupFileInput = document.getElementById('backup-file-input');
    document.getElementById('btn-backup-restore').addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', () => {
      const file = backupFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (!confirm('Restore from "' + file.name + '"? This replaces ALL current data (roster, blackouts, requests and schedules).')) {
          backupFileInput.value = '';
          return;
        }
        if (storage.importBackupJSON(evt.target.result)) {
          window.appState = storage.state;
          if (!window.appState.preferredWeekends) window.appState.preferredWeekends = [];
          const c = getActiveCycle();
          activeMonthIdx = parseDate(c.startDate).getMonth();
          closeAllModals();
          renderApp();
          showToast('Backup restored.');
        } else {
          alert('That file is not a valid backup from this program.');
        }
        backupFileInput.value = '';
      };
      reader.readAsText(file);
    });
    // Initial render
    renderApp();
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', htmlContent, 'utf8');
console.log('Successfully generated 100% self-contained index.html!');
