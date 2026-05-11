#!/usr/bin/env node
function dateInputToISOString(input) {
  if (!input) return null;
  const parts = String(input).split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const dt = new Date(y, m - 1, d);
    return dt.toISOString();
  }
  return new Date(input).toISOString();
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDeadlineLabel(deadline, completedAt) {
  if (!deadline || completedAt) return { label: '', severity: 'none' };
  const now = new Date();
  const d = new Date(deadline);
  const diffMs = d.getTime() - now.getTime();

  if (diffMs < 0) {
    const absMs = Math.abs(diffMs);
    const days = Math.floor(absMs / 86_400_000);
    if (days >= 1) return { label: `Overdue by ${days}d`, severity: 'overdue' };
    const hours = Math.ceil(absMs / 3_600_000);
    return { label: `Overdue by ${hours}h`, severity: 'overdue' };
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0,0,0,0);
  const startOfDeadlineDay = new Date(d);
  startOfDeadlineDay.setHours(0,0,0,0);
  const daysUntil = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / 86_400_000);

  if (daysUntil === 0) {
    const hours = Math.ceil(diffMs / 3_600_000);
    return { label: `Due in ${hours}h`, severity: 'due-soon' };
  }
  if (daysUntil === 1) {
    return { label: 'Due tomorrow', severity: 'due-soon' };
  }
  if (diffMs <= 48 * 3_600_000) {
    const hours = Math.ceil(diffMs / 3_600_000);
    return { label: `Due in ${hours}h`, severity: 'due-soon' };
  }
  if (daysUntil <= 7) {
    return { label: `Due in ${daysUntil}d`, severity: 'future' };
  }
  return { label: formatDate(d), severity: 'future' };
}

function showCase(name, input) {
  const out = formatDeadlineLabel(input, null);
  console.log(`${name}:`);
  console.log(`  input ISO: ${input}`);
  console.log(`  -> ${out.label} (${out.severity})`);
  console.log('');
}

console.log('Now:', new Date().toString());
console.log('Timezone offset (min):', new Date().getTimezoneOffset());
console.log('---');

// Examples
const dateOnly = dateInputToISOString('2026-05-13');
const utcMidnight = new Date(Date.UTC(2026, 4, 13, 0, 0, 0)).toISOString();
const localMidday = new Date(2026, 4, 13, 12, 0, 0).toISOString();
const plus36 = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
const plus40 = new Date(Date.now() + 40 * 3600 * 1000).toISOString();
const plus44 = new Date(Date.now() + 44 * 3600 * 1000).toISOString();

showCase('date-only (local midnight) for 2026-05-13', dateOnly);
showCase('UTC midnight for 2026-05-13', utcMidnight);
showCase('local 2026-05-13 12:00', localMidday);
showCase('now +36h', plus36);
showCase('now +40h', plus40);
showCase('now +44h', plus44);
