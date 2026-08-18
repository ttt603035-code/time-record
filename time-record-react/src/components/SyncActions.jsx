import { t } from '@/lib/i18n.js';

function formatSyncClock(ms) {
  const n = new Date(ms || Date.now());
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

export function SyncActions({ lastSyncAt, onRefresh }) {
  return (
    <div className="sync-actions">
      <span className="chip sync-chip">
        <span className="sync-chip-label">{`${t('sync')} · ${formatSyncClock(lastSyncAt)}`}</span>
      </span>
      <button
        className="chip sync-refresh"
        type="button"
        aria-label={t('refresh')}
        onClick={onRefresh}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <span className="sync-refresh-label">{t('refresh')}</span>
      </button>
    </div>
  );
}
