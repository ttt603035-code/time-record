import { RefreshCw } from 'lucide-react';

import { t } from '@/lib/i18n.js';
import { formatSyncTime } from '@/lib/sync-core.js';

function chipWhen({ syncOn, lastCloudSync, syncBusy, syncError }) {
  if (syncBusy) return t('syncing');
  if (!syncOn) return t('syncOff');
  // A failed sync is a state the user has to act on — do not show a stale
  // "5 min ago" as if all were well.
  if (syncError) return t('syncChipFailed');
  const { key, vars, literal } = formatSyncTime(lastCloudSync);
  return literal ?? t(key, vars || undefined);
}

export function SyncActions({
  lastCloudSync, syncOn, syncBusy, syncError, onSync, hideWhenOff = false,
}) {
  if (hideWhenOff && !syncOn) return null;
  const when = chipWhen({ syncOn, lastCloudSync, syncBusy, syncError });
  return (
    <div className="sync-actions">
      <button
        className={`chip sync-chip${syncError && !syncBusy ? ' is-error' : ''}`}
        type="button"
        disabled={syncBusy}
        aria-label={`${t('sync')} — ${syncError ? t(syncError.code) : when}`}
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
        <RefreshCw aria-hidden="true" />
        <span className="sync-refresh-label">{t('refresh')}</span>
      </button>
    </div>
  );
}
