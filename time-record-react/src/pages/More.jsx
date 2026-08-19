import { useEffect, useMemo, useRef, useState } from 'react';

import { openImportGuide } from '@/components/ImportGuideModal.jsx';
import { openSyncSettings } from '@/components/SyncSettingsModal.jsx';
import { useAlertDialog } from '@/hooks/useAlertDialog.jsx';
import { SyncActions } from '@/components/SyncActions.jsx';
import { THEMES } from '@/lib/themes.js';
import { formatSyncTime } from '@/lib/sync-core.js';
import { clearLastSync } from '@/lib/supabase-sync.js';
import { openTemplatesModal } from '@/components/TemplatesModal.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card.jsx';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { CATEGORY_KEY, SETTINGS_KEY, STORAGE_KEY } from '@/lib/constants.js';
import { DataService } from '@/lib/data-service.js';
import { todayISO } from '@/lib/date.js';
import { I } from '@/lib/dom.js';
import { getLang, t } from '@/lib/i18n.js';
import { toast } from '@/lib/overlays.js';
import { importPayload } from '@/lib/shortcut-import.js';
import { StorageService } from '@/lib/storage.js';
import { formatBytes } from '@/lib/analytics.js';
import { cn } from '@/lib/utils.js';

/** Renders a raw SVG string from the shared icon set. */
function Icon({ svg, className }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** A labelled figure in the Data card's three-up row. */
function StatTile({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-secondary p-3">
      <span className="text-[10px] font-extrabold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-xl font-extrabold tracking-tight">{value}</span>
    </div>
  );
}

/** Pill-shaped action button used by the Data and Language cards. */
function PillButton({ label, icon, variant = 'outline', onClick }) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className={cn(
        'h-[38px] gap-1.5 rounded-full px-4 text-[13px] font-semibold',
        variant === 'outline' && 'bg-background',
      )}
    >
      {icon ? <Icon className="[&_svg]:size-3.5" svg={icon} /> : null}
      {label}
    </Button>
  );
}

/** A tappable row in the About card. */
function SettingsRow({ icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[50px] w-full items-center gap-3 px-6 py-3 text-left text-[15px]
                 font-medium transition-colors hover:bg-secondary active:bg-black/5"
    >
      <span
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px]
                   border bg-secondary text-muted-foreground [&_svg]:size-[15px]"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      <span className="flex-1">{label}</span>
      {value ? (
        <span className="max-w-[46%] truncate text-[13px] text-muted-foreground">{value}</span>
      ) : null}
      <Icon className="size-3.5 shrink-0 text-muted-foreground opacity-70" svg={I.chevR} />
    </button>
  );
}

const EXPORT_AT_KEY = 'calendar_export_at_v1';

function loadLastExport() {
  try {
    const raw = window.localStorage.getItem(EXPORT_AT_KEY);
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
  } catch (err) {
    return null;
  }
}

function saveLastExport(iso) {
  try { window.localStorage.setItem(EXPORT_AT_KEY, iso); return true; }
  catch (err) { return false; }
}

function formatExportLabel(iso) {
  if (!iso) return t('lastExportNever');
  const { key, vars, literal } = formatSyncTime(iso);
  return t('lastExport', { s: literal ?? t(key, vars || undefined) });
}

export function MorePage({
  events, categories, lang, theme, lastCloudSync, syncOn, syncBusy, onSync,
  onSyncSaved, onSyncDisconnected, onSaveCategories, onClearAll, onApplyLanguage,
  onApplyTheme, onImported,
}) {
  const fileInputRef = useRef(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [lastExportAt, setLastExportAt] = useState(() => loadLastExport());
  const { showDialog, dialog } = useAlertDialog();
  // Always hand the modals the freshest data without rebuilding them.
  const dataRef = useRef({ events, categories });
  dataRef.current = { events, categories };

  const estimatedSize = useMemo(() => {
    try {
      return new Blob([JSON.stringify(events)]).size;
    } catch (err) {
      return JSON.stringify(events).length * 2;
    }
  }, [events]);

  /* ── Import file input (the element lives in index.html, as before) ── */
  useEffect(() => {
    const input = document.getElementById('importFile');
    if (!input) return undefined;
    fileInputRef.current = input;

    const onChange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await importPayload(data, dataRef.current.categories);
        await onImported();
        toast(t('imported', { n: res.added + res.updated }));
      } catch (err) {
        toast(t('importFailed'));
      }
    };

    input.addEventListener('change', onChange);
    return () => input.removeEventListener('change', onChange);
  }, [onImported]);

  const exportData = async () => {
    const list = await DataService.exportAll();
    const payload = {
      app: 'calendar',
      version: 1,
      exportedAt: new Date().toISOString(),
      events: list,
      categories,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar_events_' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    saveLastExport(payload.exportedAt);
    setLastExportAt(payload.exportedAt);
    toast(list.length ? t('exported', { n: list.length }) : t('noExport'));
  };

  const importData = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const clearAllData = () => {
    showDialog({
      title: t('clearAllTitle'),
      message: t('clearAllMsg'),
      actions: [
        { label: t('cancel') },
        {
          label: t('clear'),
          danger: true,
          onClick: async () => {
            await onClearAll();
            toast(t('dataCleared'));
          },
        },
      ],
    });
  };

  const showStorageInfo = () => {
    const mode = StorageService.available
      ? t('onThisDevice') + ' (localStorage).'
      : t('limitedPreview') + ' — localStorage.';
    showDialog({
      title: t('storage'),
      message: t('storageMsg', {
        n: events.length,
        s: formatBytes(estimatedSize),
        m: categories.length,
        mode,
      }),
      actions: [{ label: t('done') }],
    });
  };

  const showAbout = () => {
    showDialog({
      title: 'Calendar',
      message: t('aboutMsg'),
      actions: [{ label: t('done') }],
    });
  };

  const storageRows = useMemo(() => {
    const rows = [
      { key: STORAGE_KEY, entries: events.length, size: estimatedSize },
      { key: CATEGORY_KEY, entries: categories.length, size: JSON.stringify(categories).length * 2 },
      { key: SETTINGS_KEY, entries: '—', size: JSON.stringify({ lang: getLang() }).length * 2 },
    ];
    StorageService.backupKeys().forEach((k) => {
      let raw = '';
      try { raw = window.localStorage.getItem(k) || ''; } catch (e) { /* ignore */ }
      rows.push({ key: k, entries: '—', size: raw.length * 2 });
    });
    return rows;
  }, [events, categories, estimatedSize, lang]);

  return (
    <main className="screen is-active" id="screen-more" aria-label="More">
      <header className="topbar">
        <h1 className="page-title">{t('more')}</h1>
        <div className="topbar-end">
          <SyncActions
            lastCloudSync={lastCloudSync}
            syncOn={syncOn}
            syncBusy={syncBusy}
            onSync={onSync}
            hideWhenOff
          />
        </div>
      </header>

      <div className="mt-3.5 flex flex-col gap-4" id="moreGroups">
        {!StorageService.available ? (
          <div className="storage-notice is-visible">
            This preview blocks local storage, so changes will not survive a reload.
            Deploy to a stable HTTPS URL (e.g. GitHub Pages) for full persistence.
          </div>
        ) : null}

        {/* ── Data */}
        <Card className="gap-4 py-4">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="text-[15px] font-bold tracking-tight">{t('data')}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t('dataDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-4">
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile label={t('events')} value={String(events.length)} />
              <StatTile label={t('templates')} value={String(categories.length)} />
              <StatTile label={t('size')} value={formatBytes(estimatedSize)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <PillButton label={t('export')} icon={I.up} variant="default" onClick={exportData} />
              <PillButton label={t('import')} icon={I.down} onClick={importData} />
              <Button
                variant="outline"
                onClick={clearAllData}
                className="h-[38px] gap-1.5 rounded-full border-destructive/35 bg-transparent px-4
                           text-[13px] font-semibold text-destructive hover:bg-destructive/10
                           hover:text-destructive"
              >
                <Icon className="[&_svg]:size-3.5" svg={I.trash} />
                {t('clearAll')}
              </Button>
            </div>

            <p className="export-meta">{formatExportLabel(lastExportAt)}</p>

            {/* Storage keys — a real Collapsible instead of <details> */}
            <Collapsible
              open={keysOpen}
              onOpenChange={setKeysOpen}
              className="overflow-hidden rounded-xl border bg-secondary"
            >
              <CollapsibleTrigger
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-xs
                           font-extrabold text-muted-foreground select-none"
              >
                <span>{t('storageKeys')}</span>
                <Icon
                  className={cn(
                    'ml-auto size-3.5 transition-transform [&_svg]:size-3.5',
                    keysOpen && 'rotate-180',
                  )}
                  svg={I.chevDown}
                />
              </CollapsibleTrigger>
              <CollapsibleContent
                className="overflow-hidden data-[state=closed]:animate-collapsible-up
                           data-[state=open]:animate-collapsible-down"
              >
                <Separator />
                <div className="grid grid-cols-[minmax(0,1fr)_60px_64px] gap-2.5 px-3 py-2
                                text-[10px] font-extrabold tracking-[0.04em] text-muted-foreground uppercase">
                  <span>{t('key')}</span>
                  <span className="text-right">{t('entries')}</span>
                  <span className="text-right">{t('size')}</span>
                </div>
                <Separator />
                {storageRows.map((r, i) => (
                  <div key={r.key}>
                    {i > 0 ? <Separator className="bg-border/60" /> : null}
                    <div className="grid grid-cols-[minmax(0,1fr)_60px_64px] items-center gap-2.5 px-3 py-2.5">
                      <span className="truncate text-xs font-semibold">{r.key}</span>
                      <span className="text-right text-xs font-semibold text-muted-foreground">
                        {String(r.entries)}
                      </span>
                      <span className="text-right text-xs font-semibold text-muted-foreground">
                        {formatBytes(r.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* ── Cloud Sync */}
        <Card className="gap-4 py-4">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              {t('sync')}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] uppercase',
                  syncOn
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {syncOn ? t('syncOn') : t('syncOff')}
              </span>
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {syncOn
                ? t('syncLast', {
                  s: (() => {
                    const { key, vars, literal } = formatSyncTime(lastCloudSync);
                    return literal ?? t(key, vars || undefined);
                  })(),
                })
                : t('syncDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 px-4">
            {syncOn ? (
              <>
                <PillButton
                  label={syncBusy ? t('syncing') : t('syncNow')}
                  icon={I.sync}
                  variant="default"
                  onClick={onSync}
                />
                <PillButton
                  label={t('syncSettings')}
                  onClick={() => openSyncSettings({
                    onSaved: onSyncSaved,
                    onDisconnected: () => {
                      clearLastSync();
                      onSyncDisconnected?.();
                    },
                  })}
                />
              </>
            ) : (
              <PillButton
                label={t('syncSetUp')}
                icon={I.cloud}
                variant="default"
                onClick={() => openSyncSettings({
                  onSaved: onSyncSaved,
                  onDisconnected: () => {
                    clearLastSync();
                    onSyncDisconnected?.();
                  },                })}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Appearance */}
        <Card className="gap-4 py-4">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="text-[15px] font-bold tracking-tight">
              {t('appearance')}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t('appearanceDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 px-4">
            {THEMES.map((th) => {
              const on = theme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  aria-label={t(th.labelKey)}
                  aria-pressed={on}
                  onClick={() => onApplyTheme(th.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      'inline-flex size-[34px] items-center justify-center rounded-full',
                      'text-white transition-transform active:scale-90',
                      on && 'scale-110 ring-2 ring-offset-2 ring-offset-background',
                    )}
                    style={{
                      background: th.swatch,
                      ...(on ? { '--tw-ring-color': th.swatch } : null),
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={cn('size-4 transition-opacity', on ? 'opacity-100' : 'opacity-0')}
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t(th.labelKey)}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Language */}
        <Card className="gap-4 py-4">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="text-[15px] font-bold tracking-tight">{t('language')}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t('languageDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 px-4">
            <PillButton
              label={t('english')}
              variant={lang === 'en' ? 'default' : 'outline'}
              onClick={() => onApplyLanguage('en')}
            />
            <PillButton
              label={t('chinese')}
              variant={lang === 'zh' ? 'default' : 'outline'}
              onClick={() => onApplyLanguage('zh')}
            />
          </CardContent>
        </Card>

        {/* ── About */}
        <Card className="gap-4 overflow-hidden py-4">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="text-[15px] font-bold tracking-tight">{t('about')}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t('aboutDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="flex flex-col">
              <SettingsRow
                icon={I.tag}
                label={t('eventTemplates')}
                value={t('templatesDefined', { n: categories.length })}
                onClick={() => openTemplatesModal({
                  getCategories: () => dataRef.current.categories,
                  getEvents: () => dataRef.current.events,
                  onSave: onSaveCategories,
                })}
              />
              <Separator />
              <SettingsRow
                icon={I.db}
                label={t('storage')}
                value={StorageService.available ? t('onThisDevice') : t('limitedPreview')}
                onClick={showStorageInfo}
              />
              <Separator />
              <SettingsRow
                icon={I.down}
                label={t('importGuide')}
                onClick={openImportGuide}
              />
              <Separator />
              <SettingsRow
                icon={I.info}
                label={t('aboutCalendar')}
                value={t('version')}
                onClick={showAbout}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {dialog}
    </main>
  );
}
