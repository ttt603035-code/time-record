/* ============================================================
   Sync status badge (More screen, top-right)
   ------------------------------------------------------------
   Shows when the last sync happened, so the answer to "is my
   data safe on the other device?" is visible without scrolling
   to the sync card.
   ============================================================ */

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { t } from '@/lib/i18n.js';
import { formatSyncTime } from '@/lib/sync-core.js';
import { cn } from '@/lib/utils.js';

export function SyncStatusBadge({ configured, syncedAt, busy, onClick, lang }) {
  // A relative label ("5 min ago") goes stale on its own, so re-render it on a
  // timer rather than only when the sync state changes.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!configured) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [configured]);

  if (!configured) return null;

  const { key, vars, literal } = formatSyncTime(syncedAt);
  const when = busy ? t('syncing') : (literal ?? t(key, vars || undefined));

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`${t('sync')} — ${when}`}
      className={cn(
        'flex items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1',
        'text-[11px] font-semibold text-muted-foreground transition-colors',
        'hover:bg-secondary/70 active:opacity-60 disabled:opacity-60',
      )}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn('size-3', busy && 'animate-spin')}
      />
      <span>{when}</span>
    </button>
  );
}
