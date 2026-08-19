import { useCallback, useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { ColorSwatches } from '@/components/ColorSwatches.jsx';
import { resolveColor } from '@/lib/constants.js';
import { formatShortDate, t } from '@/lib/i18n.js';
import { buildDateWheel, buildTimeWheel } from '@/lib/overlays.js';
import { cn } from '@/lib/utils.js';

/**
 * Accordion trigger + iOS wheel picker.
 *
 * The wheel itself stays imperative — its scroll-snap columns are the most
 * touch-sensitive part of the app — but the trigger is now a shadcn-styled
 * control. Mounting happens on open so the wheel always starts on the
 * current value.
 */
function WheelField({ label, value, display, kind, open, onToggle, onChange }) {
  const hostRef = useRef(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.innerHTML = '';
    if (!open) return undefined;
    const emit = (v) => changeRef.current && changeRef.current(v);
    if (kind === 'date') buildDateWheel(host, value, emit);
    else buildTimeWheel(host, value, emit);
    return () => { host.innerHTML = ''; };
    // `value` is intentionally omitted: rebuilding on every tick would fight
    // the user's scroll. The wheel owns its value while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  return (
    <div className="flex-1">
      <Label className="mb-1.5 text-xs text-muted-foreground">{label}</Label>
      <button
        type="button"
        data-slot="picker-trigger"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3',
          'text-base font-medium shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          open && 'border-ring ring-[3px] ring-ring/50',
        )}
      >
        <span>{display}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={cn('wheel-zone', open && 'is-open')}>
        <div ref={hostRef} />
      </div>
    </div>
  );
}

/**
 * Event form body — the add/edit fields, now built with shadcn controls.
 *
 * Rendered into the existing StudyHub-style modal via a portal, so the modal
 * shell (drag-to-dismiss, stacking, focus restore) is untouched. The parent
 * owns the draft; this component reports changes upward.
 */
export function EventFormFields({
  draft,
  onPatch,
  categories,
  error,
  onClearError,
  onDelete,
  isEdit,
}) {
  const [picker, setPicker] = useState(null);

  const toggle = useCallback((kind) => {
    setPicker((cur) => (cur === kind ? null : kind));
  }, []);

  const pickCategory = (cat) => {
    onPatch({ category: cat.name, color: cat.color });
  };

  const onCategoryInput = (e) => {
    const name = e.target.value;
    const match = categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    onPatch(match ? { category: name, color: match.color } : { category: name });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div>
        <Label htmlFor="ev-title" className="mb-1.5 text-xs text-muted-foreground">
          {t('title')}
        </Label>
        <Input
          id="ev-title"
          type="text"
          className="h-11"
          placeholder={t('titlePlaceholder')}
          autoComplete="off"
          aria-invalid={!!error}
          value={draft.title}
          onChange={(e) => { onPatch({ title: e.target.value }); onClearError(); }}
        />
        {error ? (
          <span className="mt-1.5 block text-xs font-medium text-destructive">{error}</span>
        ) : null}
      </div>

      {/* Date */}
      <WheelField
        label={t('date')}
        kind="date"
        value={draft.date}
        display={formatShortDate(draft.date)}
        open={picker === 'date'}
        onToggle={() => toggle('date')}
        onChange={(iso) => onPatch({ date: iso })}
      />

      {/* Start / End */}
      <div className="flex gap-2.5">
        <WheelField
          label={t('start')}
          kind="time"
          value={draft.startTime}
          display={draft.startTime}
          open={picker === 'start'}
          onToggle={() => toggle('start')}
          onChange={(v) => onPatch({ startTime: v })}
        />
        <WheelField
          label={t('end')}
          kind="time"
          value={draft.endTime}
          display={draft.endTime}
          open={picker === 'end'}
          onToggle={() => toggle('end')}
          onChange={(v) => onPatch({ endTime: v })}
        />
      </div>

      {/* Category + quick-pick templates */}
      <div>
        <Label htmlFor="ev-category" className="mb-1.5 text-xs text-muted-foreground">
          {t('category')}
        </Label>
        <Input
          id="ev-category"
          type="text"
          className="h-11"
          placeholder={t('categoryPlaceholder')}
          autoComplete="off"
          list="catSuggestions"
          value={draft.category}
          onChange={onCategoryInput}
        />
        <datalist id="catSuggestions">
          {categories.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = draft.category === cat.name;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => pickCategory(cat)}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 py-1.5',
                  'text-[13px] font-semibold transition-colors',
                  active
                    ? 'border-foreground bg-secondary'
                    : 'border-input bg-secondary hover:bg-accent',
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: resolveColor(cat.color) }}
                />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color */}
      <div>
        <Label className="mb-1.5 text-xs text-muted-foreground">{t('color')}</Label>
        <ColorSwatches value={draft.color} onChange={(c) => onPatch({ color: c })} />
      </div>

      {/* Note */}
      <div>
        <Label htmlFor="ev-note" className="mb-1.5 text-xs text-muted-foreground">
          {t('note')}
        </Label>
        <Textarea
          id="ev-note"
          rows={2}
          className="resize-none"
          placeholder={t('notePlaceholder')}
          value={draft.note}
          onChange={(e) => onPatch({ note: e.target.value })}
        />
      </div>

      {/* Delete (edit only) */}
      {isEdit ? (
        <button
          type="button"
          onClick={onDelete}
          className="min-h-11 w-full rounded-md py-3 text-center text-[15px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          {t('deleteEvent')}
        </button>
      ) : null}
    </div>
  );
}
