import { t } from '@/lib/i18n.js';

/** Empty-state block used by the Calendar day detail and the Today list. */
export function EmptyState({ onAdd }) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
        <path d="M3.5 9.5h17" />
        <path d="M8.2 2.8v3.4M15.8 2.8v3.4" />
      </svg>
      <p>{t('noEvents')}</p>
      <button type="button" onClick={onAdd}>{t('addEventCta')}</button>
    </div>
  );
}
