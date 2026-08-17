/* ============================================================
   Import-from-Shortcuts guide
   ------------------------------------------------------------
   Phase 2: rebuilt as React + shadcn, and rewritten to describe
   the actual one-tap flow (Shortcut -> Open URLs -> app imports)
   rather than the old save-a-file-then-import flow.

   Rendered into the imperative StudyHub modal via createRoot, the
   same pattern as the event form: the shell keeps its touch
   behaviour, React owns the content.
   ============================================================ */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import { openStudyModal } from '@/lib/overlays.js';
import { cn } from '@/lib/utils.js';

/** The Text action body, one JSON object per calendar event. */
const TEXT_ACTION = `{"id":"cal_[Calendar Event]","date":"[Start Date]",
"startTime":"[Start Date]","endTime":"[End Date]",
"title":"[Title]","category":"[Calendar]","note":""}`;

const WRAP_ACTION = '[[Combined Text]]';

const OPEN_URL = 'https://ttt603035-code.github.io/time-record/?import=[URL Encoded Text]';

function CopyBlock({ text, className }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Clipboard API needs a secure context; fall back to a temporary field.
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
    <div className={cn('relative', className)}>
      <pre className="json-block !mb-0 pr-16">{text}</pre>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'absolute top-2 right-2 rounded-md border border-input bg-background px-2.5 py-1',
          'text-[11px] font-semibold shadow-xs transition-colors',
          'hover:bg-accent active:bg-accent',
          copied && 'border-foreground',
        )}
      >
        {copied ? t('guideCopied') : t('guideCopy')}
      </button>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full
                   bg-primary text-[12px] font-semibold text-primary-foreground"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </li>
  );
}

function StepText({ children }) {
  return <p className="text-[13.5px] leading-relaxed text-muted-foreground">{children}</p>;
}

function ImportGuide() {
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        {t('importGuideDesc')}
      </p>

      <div>
        <h3 className="mb-3 text-[13px] font-semibold tracking-wide">
          {t('guideStepsTitle')}
        </h3>
        <ol className="space-y-4">
          <Step n="1"><StepText>{t('guideStep1')}</StepText></Step>
          <Step n="2"><StepText>{t('guideStep2')}</StepText></Step>
          <Step n="3">
            <StepText>{t('guideStep3')}</StepText>
            <CopyBlock text={TEXT_ACTION} />
            {/* The app validates these formats strictly, so spell them out:
                a wrong date silently falls back to today. */}
            <div className="rounded-lg border border-input bg-secondary/60 p-3">
              <p className="mb-1.5 text-[12.5px] font-semibold">{t('guideFormatTitle')}</p>
              <ul className="space-y-1">
                <li className="flex gap-2 text-[12.5px] text-muted-foreground">
                  <span aria-hidden="true" className="text-foreground">·</span>
                  <span><code className="font-mono">date</code> — {t('guideFormatDate')}</span>
                </li>
                <li className="flex gap-2 text-[12.5px] text-muted-foreground">
                  <span aria-hidden="true" className="text-foreground">·</span>
                  <span>
                    <code className="font-mono">startTime</code>,{' '}
                    <code className="font-mono">endTime</code> — {t('guideFormatTime')}
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-[12px] leading-relaxed text-destructive">
                {t('guideFormatWarn')}
              </p>
            </div>
          </Step>
          <Step n="4"><StepText>{t('guideStep4')}</StepText></Step>
          <Step n="5">
            <StepText>{t('guideStep5')}</StepText>
            <CopyBlock text={WRAP_ACTION} />
          </Step>
          <Step n="6">
            <StepText>{t('guideStep6')}</StepText>
            <CopyBlock text={OPEN_URL} />
          </Step>
        </ol>
      </div>

      <div className="rounded-lg bg-secondary p-3.5">
        <h3 className="mb-2 text-[13px] font-semibold">{t('guideTipsTitle')}</h3>
        <ul className="space-y-1.5">
          {[t('guideTip1'), t('guideTip2'), t('guideTip3'), t('guideTip4')].map((tip) => (
            <li key={tip} className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="text-foreground">·</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        {t('importGuideNote')}
      </p>
    </div>
  );
}

export function openImportGuide() {
  const body = el('div');
  const api = openStudyModal({
    title: t('importGuide'),
    body,
    onClose: () => setTimeout(() => root.unmount(), 0),
  });
  const root = createRoot(body);
  root.render(<ImportGuide />);
  return api;
}
