/* ============================================================
   Cloud Sync settings
   ------------------------------------------------------------
   Rendered into the imperative StudyHub modal via createRoot —
   the same pattern as the event form and the import guide: the
   shell keeps its touch behaviour, React owns the content.
   ============================================================ */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import { openStudyModal, toast } from '@/lib/overlays.js';
import {
  SETUP_SQL, clearConfig, loadConfig, resetClient, saveConfig, testConnection,
} from '@/lib/supabase-sync.js';
import { validateConfig } from '@/lib/sync-core.js';
import { cn } from '@/lib/utils.js';

/** Read-only SQL block with a copy button. */
function SqlBlock({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative">
      <pre
        className="max-h-44 overflow-auto rounded-xl border bg-secondary p-3 pr-16
                   text-[11px] leading-relaxed whitespace-pre-wrap"
      >
        {text}
      </pre>
      <Button
        variant="outline"
        onClick={copy}
        className="absolute top-2 right-2 h-7 rounded-full bg-background px-3 text-[11px] font-semibold"
      >
        {copied ? '✓' : 'Copy'}
      </Button>
    </div>
  );
}

/** One labelled credential field with its hint and inline error. */
function Field({ id, label, hint, error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-semibold">{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="h-10 rounded-xl"
        {...props}
      />
      {error
        ? <p className="text-[11px] font-medium text-destructive">{t(error)}</p>
        : <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SyncSettings({ onSaved, onDisconnected, close }) {
  const existing = loadConfig();
  const [url, setUrl] = useState(existing?.url || '');
  const [anonKey, setAnonKey] = useState(existing?.anonKey || '');
  const [userKey, setUserKey] = useState(existing?.userKey || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showSql, setShowSql] = useState(!existing);

  const draft = { url, anonKey, userKey };

  const runTest = async () => {
    const { ok, errors: errs, config } = validateConfig(draft);
    setErrors(errs);
    setResult(null);
    if (!ok) return null;

    setBusy(true);
    const res = await testConnection(config);
    setBusy(false);
    setResult(res.ok
      ? { ok: true, message: t('syncOkFound', { n: res.count }) }
      : { ok: false, message: t(res.code) });
    return res.ok ? config : null;
  };

  const save = async () => {
    // Never store credentials that have not been proven to work — a silently
    // broken config is worse than no config, because sync appears to be on.
    const config = await runTest();
    if (!config) return;
    saveConfig(config);
    resetClient();
    toast(t('syncSaved'));
    onSaved?.(config);
    close();
  };

  const disconnect = () => {
    clearConfig();
    resetClient();
    toast(t('syncDisconnected'));
    onDisconnected?.();
    close();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {t('syncDesc')}
      </p>

      <div className="flex flex-col gap-3">
        <Field
          id="sync-url"
          label={t('syncUrl')}
          hint={t('syncUrlHint')}
          error={errors.url}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://xxxxx.supabase.co"
          inputMode="url"
        />
        <Field
          id="sync-key"
          label={t('syncAnonKey')}
          hint={t('syncAnonKeyHint')}
          error={errors.anonKey}
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOi…"
          type="password"
        />
        <Field
          id="sync-user"
          label={t('syncUserKey')}
          hint={t('syncUserKeyHint')}
          error={errors.userKey}
          value={userKey}
          onChange={(e) => setUserKey(e.target.value)}
          placeholder="my-private-phrase"
        />
      </div>

      {result ? (
        <p
          className={cn(
            'rounded-xl border px-3 py-2 text-[12px] font-medium',
            result.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
        >
          {result.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={save}
          disabled={busy}
          className="h-[38px] flex-1 rounded-full text-[13px] font-semibold"
        >
          {busy ? t('syncTesting') : t('save')}
        </Button>
        <Button
          variant="outline"
          onClick={runTest}
          disabled={busy}
          className="h-[38px] rounded-full bg-background px-4 text-[13px] font-semibold"
        >
          {t('syncTest')}
        </Button>
      </div>

      {existing ? (
        <Button
          variant="ghost"
          onClick={disconnect}
          className="h-[38px] rounded-full text-[13px] font-semibold text-destructive hover:bg-destructive/10"
        >
          {t('syncDisconnect')}
        </Button>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="flex items-center justify-between text-left text-[13px] font-semibold"
        >
          <span>{t('syncSetupSql')}</span>
          <span className="text-muted-foreground">{showSql ? '−' : '+'}</span>
        </button>
        {showSql ? (
          <>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('syncSetupSqlDesc')}
            </p>
            <SqlBlock text={SETUP_SQL} />
          </>
        ) : null}
      </div>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2
                    text-[11px] leading-relaxed text-amber-800">
        {t('syncSecurityNote')}
      </p>
    </div>
  );
}

export function openSyncSettings({ onSaved, onDisconnected } = {}) {
  const body = el('div');
  const api = openStudyModal({
    title: t('sync'),
    body,
    onClose: () => setTimeout(() => root.unmount(), 0),
  });
  const root = createRoot(body);
  root.render(
    <SyncSettings
      onSaved={onSaved}
      onDisconnected={onDisconnected}
      close={() => api.close()}
    />,
  );
  return api;
}
