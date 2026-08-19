/* ============================================================
   EVENT TEMPLATES (categories)
   ------------------------------------------------------------
   Phase 2: rebuilt as React + shadcn. Each template is still
   { id, name, color } — add, rename, recolor, delete — and the
   save/merge rules are unchanged.

   The list and the add/edit form used to swap through the modal's
   imperative `setContent`; here they are one component with a
   `view` state. The modal shell stays imperative (drag-to-dismiss,
   stacking, focus restore) with React mounted inside it.
   ============================================================ */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { ColorSwatches } from '@/components/ColorSwatches.jsx';
import { resolveColor } from '@/lib/constants.js';
import { t } from '@/lib/i18n.js';
import { useAlertDialog } from '@/hooks/useAlertDialog.jsx';
import { normalizeCategory } from '@/lib/model.js';
import { el } from '@/lib/dom.js';
import { openStudyModal, toast } from '@/lib/overlays.js';
import { cn } from '@/lib/utils.js';

let tplApi = null;

/** Footer content is portalled into the modal's own footer slot. */
function Footer({ children }) {
  const host = document.querySelector('.study-modal-foot');
  if (!host) return null;
  return createPortal(children, host);
}

/** Title lives in the imperative shell; keep it in sync from React. */
function useModalTitle(title) {
  const node = document.querySelector('.study-modal-title');
  if (node && node.textContent !== title) node.textContent = title;
}

function TemplateList({ categories, events, onEdit, onAdd, onDelete }) {
  useModalTitle(t('eventTemplates'));

  return (
    <>
      {!categories.length ? (
        <div className="px-2 py-5 text-center text-sm text-muted-foreground">
          {t('noTemplates')}
        </div>
      ) : (
        <div className="flex flex-col">
          {categories.map((cat) => {
            const n = events.filter((e) => (e.category || '') === cat.name).length;
            return (
              <div
                key={cat.id}
                className="group flex items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary"
              >
                <button
                  type="button"
                  onClick={() => onEdit(cat)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                >
                  <span
                    className="size-3.5 shrink-0 rounded-full"
                    style={{ background: resolveColor(cat.color) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {cat.name}
                  </span>
                  {n ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {n === 1 ? t('oneEventUsed') : t('eventsUsed', { n })}
                    </span>
                  ) : null}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground opacity-70"
                  >
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label={t('delete') + ' ' + cat.name}
                  onClick={() => onDelete(cat)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground
                             transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
                    <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Footer>
        <span className="flex-1 text-xs leading-snug text-muted-foreground">
          {t('templatesHint')}
        </span>
        <Button size="lg" className="rounded-full" onClick={onAdd}>
          {t('addTemplate')}
        </Button>
      </Footer>
    </>
  );
}

function TemplateForm({ cat, onSave, onCancel }) {
  const isEdit = !!cat;
  useModalTitle(isEdit ? t('editTemplate') : t('newTemplate'));

  const [name, setName] = useState(isEdit ? cat.name : '');
  const [color, setColor] = useState(isEdit ? cat.color : 'blue');
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    onSave({ id: isEdit ? cat.id : null, name: name.trim(), color }, isEdit);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="tpl-name" className="mb-1.5 text-xs text-muted-foreground">
          {t('name')}
        </Label>
        <Input
          id="tpl-name"
          type="text"
          className="h-11"
          placeholder={t('namePlaceholder')}
          autoComplete="off"
          aria-invalid={invalid}
          value={name}
          onChange={(e) => { setName(e.target.value); setInvalid(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-xs text-muted-foreground">{t('color')}</Label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      <Footer>
        <span className="flex-1" />
        <Button variant="secondary" size="lg" className="rounded-full" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size="lg" className="rounded-full" onClick={submit}>
          {isEdit ? t('save') : t('add')}
        </Button>
      </Footer>
    </div>
  );
}

function TemplatesManager({ ctx }) {
  // 'list' | { editing: cat|null }
  const [view, setView] = useState('list');
  const { showDialog, dialog } = useAlertDialog();
  // Bump to re-read categories/events after a save or delete.
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const categories = ctx.getCategories();
  const events = ctx.getEvents();

  const save = async (draft, isEdit) => {
    const catObj = normalizeCategory(draft);
    const next = ctx.getCategories().slice();
    if (isEdit) {
      const i = next.findIndex((c) => c.id === draft.id);
      if (i >= 0) next[i] = catObj;
    } else {
      // Same-name templates merge rather than duplicate — unchanged behaviour.
      const i = next.findIndex((c) => c.name.toLowerCase() === catObj.name.toLowerCase());
      if (i >= 0) next[i] = catObj;
      else next.push(catObj);
    }
    await ctx.onSave(next);
    setView('list');
    refresh();
    toast(isEdit ? t('templateSaved') : t('templateAdded'));
  };

  const remove = (cat) => {
    showDialog({
      title: t('deleteTemplateTitle'),
      message: '“' + cat.name + '” ' + t('deleteTemplateMsg'),
      actions: [
        { label: t('cancel') },
        {
          label: t('delete'),
          danger: true,
          onClick: async () => {
            await ctx.onSave(ctx.getCategories().filter((c) => c.id !== cat.id));
            refresh();
            toast(t('templateDeleted'));
          },
        },
      ],
    });
  };

  if (view === 'list') {
    return (
      <>
        <TemplateList
          categories={categories}
          events={events}
          onEdit={(cat) => setView({ editing: cat })}
          onAdd={() => setView({ editing: null })}
          onDelete={remove}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <TemplateForm
        cat={view.editing}
        onSave={save}
        onCancel={() => setView('list')}
      />
      {dialog}
    </>
  );
}

/**
 * Open the Event Templates manager.
 *
 * @param {object}   ctx
 * @param {Function} ctx.getCategories () => object[]  (always current)
 * @param {Function} ctx.getEvents     () => object[]
 * @param {Function} ctx.onSave        async (list) => void
 */
export function openTemplatesModal(ctx) {
  if (tplApi && !tplApi.closed) return;

  const body = el('div');
  const footer = el('div', 'study-modal-foot');

  const api = openStudyModal({
    title: t('eventTemplates'),
    body,
    footer,
    onClose: () => {
      tplApi = null;
      setTimeout(() => root.unmount(), 0);
    },
  });
  tplApi = api;

  const root = createRoot(body);
  root.render(<TemplatesManager ctx={ctx} />);
  return api;
}
