import { t } from '@/lib/i18n.js';
import { formatSyncTime } from '@/lib/sync-core.js';

function chipWhen({ syncOn, lastCloudSync, syncBusy }) {
  if (syncBusy) return t('syncing');
  if (!syncOn) return t('syncOff');
  const { key, vars, literal } = formatSyncTime(lastCloudSync);
  return literal ?? t(key, vars || undefined);
}

export function SyncActions({
  lastCloudSync, syncOn, syncBusy, onSync, hideWhenOff = false,
}) {
  if (hideWhenOff && !syncOn) return null;
  const when = chipWhen({ syncOn, lastCloudSync, syncBusy });
  return (
    <div className="sync-actions">
      <button
        className="chip sync-chip"
        type="button"
        disabled={syncBusy}
        aria-label={`${t('sync')} — ${when}`}
        onClick={onSync}
      >
        <span className="sync-chip-label">{`${t('syncChip')} · ${when}`}</span>
      </button>
      <button
        className={`chip sync-refresh${syncBusy ? ' is-spinning' : ''}`}
        type="button"
        aria-label={t('refresh')}
        disabled={syncBusy}
        onClick={onSync}
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
