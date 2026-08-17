/* ============================================================
   13. DEMO DATA  (seeded exactly once, never overwriting)
   ------------------------------------------------------------
   Ported verbatim from legacy app.js.
   ============================================================ */

import { todayISO, addDaysISO } from './date.js';
import { normalizeEvent } from './model.js';

export function buildDemoEvents() {
  const t = todayISO();
  const list = [
    // ── Today ──
    { date: t, startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: t, startTime: '14:00', endTime: '15:00', title: '春江花月夜', category: 'Chinese', color: 'purple', note: 'Review poem analysis' },
    { date: t, startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, 1), startTime: '07:30', endTime: '08:10', title: 'Morning Run', category: 'Health', color: 'green' },
    // ── Yesterday ──
    { date: addDaysISO(t, -1), startTime: '08:00', endTime: '08:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -1), startTime: '10:00', endTime: '11:30', title: '高数练习', category: 'Study', color: 'blue', note: 'Chapter 6 — integrals' },
    { date: addDaysISO(t, -1), startTime: '19:00', endTime: '21:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    // ── Two days ago ──
    { date: addDaysISO(t, -2), startTime: '08:00', endTime: '09:00', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -2), startTime: '16:00', endTime: '17:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -2), startTime: '20:00', endTime: '20:45', title: 'Weekly Review', category: 'Personal', color: 'pink' },
    // ── Rest of this week ──
    { date: addDaysISO(t, -3), startTime: '07:20', endTime: '08:00', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -3), startTime: '19:30', endTime: '20:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -4), startTime: '09:00', endTime: '11:00', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -4), startTime: '14:00', endTime: '15:30', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -5), startTime: '08:00', endTime: '08:45', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -6), startTime: '10:00', endTime: '11:00', title: 'Writing', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -6), startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    // ── Earlier this month ──
    { date: addDaysISO(t, -8), startTime: '07:30', endTime: '08:10', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -9), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -9), startTime: '20:00', endTime: '21:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -11), startTime: '14:00', endTime: '15:30', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -12), startTime: '08:00', endTime: '08:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -12), startTime: '19:00', endTime: '21:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, -14), startTime: '10:00', endTime: '11:30', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -15), startTime: '16:00', endTime: '17:00', title: 'Writing', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -16), startTime: '07:30', endTime: '08:15', title: 'Morning Run', category: 'Health', color: 'green' },
    // ── Previous month — so the year trend has shape ──
    { date: addDaysISO(t, -21), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -24), startTime: '15:00', endTime: '16:00', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -27), startTime: '10:00', endTime: '11:00', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -30), startTime: '19:00', endTime: '20:00', title: 'Book Club', category: 'Personal', color: 'purple', note: 'Chapter 4' },
    { date: addDaysISO(t, -34), startTime: '09:00', endTime: '10:00', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -37), startTime: '08:00', endTime: '08:40', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -40), startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, -44), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -48), startTime: '07:30', endTime: '08:05', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -52), startTime: '14:00', endTime: '15:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -58), startTime: '20:00', endTime: '21:00', title: 'Weekly Review', category: 'Personal', color: 'pink' },
  ];
  return list.map(normalizeEvent);
}
