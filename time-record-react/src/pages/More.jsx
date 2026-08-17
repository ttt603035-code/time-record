import { useEffect, useMemo, useRef } from 'react';

import { openImportGuide } from '@/components/ImportGuideModal.jsx';
import { openTemplatesModal } from '@/components/TemplatesModal.jsx';
import { StatTile } from '@/components/insights/StatTile.jsx';
import { CATEGORY_KEY, SETTINGS_KEY, STORAGE_KEY } from '@/lib/constants.js';
import { DataService } from '@/lib/data-service.js';
import { todayISO } from '@/lib/date.js';
import { I } from '@/lib/dom.js';
import { getLang, t } from '@/lib/i18n.js';
import { showDialog, toast } from '@/lib/overlays.js';
import { importPayload } from '@/lib/shortcut-import.js';
import { StorageService } from '@/lib/storage.js';
import { formatBytes } from '@/lib/analytics.js';

/** Renders a raw SVG string from the shared icon set. */
function Icon({ svg, className }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function SegButton({ label, icon, primary, danger, onClick }) {
  let cls = 'btn-seg';
  if (primary) cls += ' is-primary';
  if (danger) cls += ' is-danger';
  return (
    <button className={cls} type="button" onClick={onClick}>
      {icon ? <Icon className="btn-seg-icon" svg={icon} /> : null}
      {label}
    </button>
  );
}

function SettingsRow({ icon, label, value, onClick }) {
  return (
    <button className="settings-row" type="button" onClick={onClick}>
      {icon ? <Icon className="row-icon" svg={icon} /> : null}
      <span className="row-label">{label}</span>
      {value ? <span className="row-value">{value}</span> : null}
      <Icon className="row-chev" svg={I.chevR} />
    </button>
  );
}

export function MorePage({
  events, categories, lang, onSaveCategories, onClearAll, onApplyLanguage, onImported,
}) {
  const fileInputRef = useRef(null);
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
      </header>

      <div className="more-groups" id="moreGroups">
        {!StorageService.available ? (
          <div className="storage-notice is-visible">
            This preview blocks local storage, so changes will not survive a reload.
            Deploy to a stable HTTPS URL (e.g. GitHub Pages) for full persistence.
          </div>
        ) : null}

        {/* ── Data */}
        <section className="settings-card">
          <div className="settings-head">
            <h2 className="settings-title">{t('data')}</h2>
            <p className="settings-desc">{t('dataDesc')}</p>
          </div>
          <div className="stat-row">
            <StatTile label={t('events')} value={String(events.length)} />
            <StatTile label={t('templates')} value={String(categories.length)} />
            <StatTile label={t('size')} value={formatBytes(estimatedSize)} />
          </div>
          <div className="settings-actions">
            <SegButton label={t('export')} icon={I.up} primary onClick={exportData} />
            <SegButton label={t('import')} icon={I.down} onClick={importData} />
            <SegButton label={t('clearAll')} icon={I.trash} danger onClick={clearAllData} />
          </div>

          <details className="key-details">
            <summary>
              <span>{t('storageKeys')}</span>
              <Icon className="key-chev" svg={I.chevDown} />
            </summary>
            <div className="key-details-body">
              <div className="key-list-head">
                <span className="key-name">{t('key')}</span>
                <span className="key-num">{t('entries')}</span>
                <span className="key-size">{t('size')}</span>
              </div>
              {storageRows.map((r) => (
                <div className="key-row" key={r.key}>
                  <span className="key-name">{r.key}</span>
                  <span className="key-num">{String(r.entries)}</span>
                  <span className="key-size">{formatBytes(r.size)}</span>
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* ── Language */}
        <section className="settings-card">
          <div className="settings-head">
            <h2 className="settings-title">{t('language')}</h2>
            <p className="settings-desc">{t('languageDesc')}</p>
          </div>
          <div className="lang-btns">
            <SegButton
              label={t('english')}
              primary={lang === 'en'}
              onClick={() => onApplyLanguage('en')}
            />
            <SegButton
              label={t('chinese')}
              primary={lang === 'zh'}
              onClick={() => onApplyLanguage('zh')}
            />
          </div>
        </section>

        {/* ── About */}
        <section className="settings-card">
          <div className="settings-head">
            <h2 className="settings-title">{t('about')}</h2>
            <p className="settings-desc">{t('aboutDesc')}</p>
          </div>
          <div className="settings-rows">
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
            <SettingsRow
              icon={I.db}
              label={t('storage')}
              value={StorageService.available ? t('onThisDevice') : t('limitedPreview')}
              onClick={showStorageInfo}
            />
            <SettingsRow
              icon={I.down}
              label={t('importGuide')}
              onClick={openImportGuide}
            />
            <SettingsRow
              icon={I.info}
              label={t('aboutCalendar')}
              value={t('version')}
              onClick={showAbout}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
