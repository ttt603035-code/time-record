/* ============================================================
   Import-from-Shortcuts guide  (ported verbatim from legacy app.js)
   ============================================================ */

import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import { openStudyModal } from '@/lib/overlays.js';

export function openImportGuide() {
  const sample = [
    {
      date: '2026-08-16',
      startTime: '09:00',
      endTime: '10:30',
      title: 'CET-6 Reading',
      category: 'English',
      color: 'blue',
      note: 'optional',
    },
  ];
  const body = el('div');
  const desc = el('p', 'settings-desc', t('importGuideDesc'));
  desc.style.marginBottom = '12px';
  body.appendChild(desc);
  const pre = el('pre', 'json-block', JSON.stringify(sample, null, 2));
  body.appendChild(pre);
  const note = el('p', 'settings-desc', t('importGuideNote'));
  note.style.marginTop = '12px';
  body.appendChild(note);
  openStudyModal({ title: t('importGuide'), body });
}
