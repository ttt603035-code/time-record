/* ============================================================
   19. EVENT FORM  (add / edit)
   ------------------------------------------------------------
   Phase 2: the fields are now React + shadcn (EventFormFields).

   The modal *shell* is still the imperative StudyHub modal — it
   owns drag-to-dismiss, stacking, scrim and focus restore, all of
   which are touch-critical on iPhone. The form body is mounted
   into it with createPortal, so React owns the content while the
   shell stays exactly as it was.
   ============================================================ */

import { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button.jsx';
import { EventFormFields } from '@/components/EventFormFields.jsx';
import { addMinutes, todayISO } from '@/lib/date.js';
import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import { DEFAULT_CATEGORIES, normalizeCategory, normalizeEvent } from '@/lib/model.js';
import { openStudyModal, showDialog, toast } from '@/lib/overlays.js';
import { defaultTimes } from '@/lib/analytics.js';

/** The stateful form: draft state, validation, save/delete. */
function EventForm({ existing, initialDate, categories, onCreate, onUpdate, onDelete, close }) {
  const [draft, setDraft] = useState(() => {
    const def = defaultTimes(initialDate, todayISO());
    return {
      id: existing ? existing.id : null,
      date: initialDate,
      startTime: existing ? existing.startTime : def.start,
      endTime: existing ? existing.endTime : def.end,
      title: existing ? existing.title : '',
      category: existing ? existing.category : '',
      color: existing ? existing.color : 'blue',
      note: existing ? existing.note : '',
    };
  });
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);
  const clearError = useCallback(() => setError(''), []);

  const confirmDelete = () => {
    showDialog({
      title: t('deleteEventTitle'),
      message: '“' + existing.title + '” ' + t('deleteEventMsg'),
      actions: [
        { label: t('cancel') },
        {
          label: t('delete'),
          danger: true,
          onClick: async () => {
            await onDelete(existing.id);
            close();
            toast(t('eventDeleted'));
          },
        },
      ],
    });
  };

  const save = async () => {
    if (savingRef.current) return;
    const title = draft.title.trim();
    if (!title) {
      setError(t('titleRequired'));
      return;
    }
    // Same guard as before: an end at or before the start becomes start + 1h.
    const endTime = draft.endTime <= draft.startTime
      ? addMinutes(draft.startTime, 60)
      : draft.endTime;

    savingRef.current = true;
    const saved = normalizeEvent({
      id: draft.id,
      date: draft.date,
      startTime: draft.startTime,
      endTime,
      title,
      category: draft.category.trim(),
      color: draft.color,
      note: draft.note.trim(),
      createdAt: existing ? existing.createdAt : undefined,
      updatedAt: new Date().toISOString(),
    });
    if (draft.id) await onUpdate(saved);
    else await onCreate(saved);
    close();
    toast(draft.id ? t('eventSaved') : t('eventAdded'));
  };

  return (
    <>
      <EventFormFields
        draft={draft}
        onPatch={patch}
        categories={categories}
        error={error}
        onClearError={clearError}
        onDelete={confirmDelete}
        isEdit={!!existing}
      />
      <FormFooter
        submitLabel={existing ? t('save') : t('addEvent')}
        onCancel={close}
        onSubmit={save}
      />
    </>
  );
}

/** Footer is portalled into the modal's own footer slot. */
function FormFooter({ submitLabel, onCancel, onSubmit }) {
  const host = document.querySelector('.study-modal-foot');
  if (!host) return null;
  return createPortal(
    <>
      <span className="flex-1" />
      <Button variant="secondary" size="lg" className="rounded-full" onClick={onCancel}>
        {t('cancel')}
      </Button>
      <Button size="lg" className="rounded-full" onClick={onSubmit}>
        {submitLabel}
      </Button>
    </>,
    host,
  );
}

/**
 * Open the add/edit event form.
 *
 * Signature and behaviour are unchanged from phase 1 — only the rendering of
 * the body changed.
 */
export function openEventForm(ctx) {
  const {
    eventId, events, categories, selectedDate,
    onCreate, onUpdate, onDelete,
  } = ctx;

  const existing = eventId ? events.find((e) => e.id === eventId) : null;
  const initialDate = existing ? existing.date : (ctx.date || selectedDate);
  const cats = categories.length ? categories : DEFAULT_CATEGORIES.map(normalizeCategory);

  const body = el('div');
  const footer = el('div', 'study-modal-foot');

  const api = openStudyModal({
    title: existing ? t('editEvent') : t('newEvent'),
    body,
    footer,
    onClose: () => {
      // Unmount on the next tick: React cannot unmount during its own render.
      setTimeout(() => root.unmount(), 0);
    },
  });

  const root = createRoot(body);
  root.render(
    <EventForm
      existing={existing}
      initialDate={initialDate}
      categories={cats}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      close={() => api.close()}
    />,
  );
}
