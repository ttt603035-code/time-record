/* ============================================================
   Bottom sheet — shadcn/ui Sheet (Radix Dialog) plus the
   drag-to-dismiss gesture the imperative sheet had.
   ------------------------------------------------------------
   Radix gives us the accessibility work for free: focus trap and
   restore, aria-modal, Escape, scroll locking, and the open/close
   animation states. The drag is ours, reimplemented on top.
   ============================================================ */

import { Dialog as SheetPrimitive } from 'radix-ui';
import { useCallback, useEffect, useRef } from 'react';

import { I } from '@/lib/dom.js';
import { cn } from '@/lib/utils.js';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

/** Drag past this many pixels and the sheet dismisses. Matches the legacy value. */
const DISMISS_PX = 130;
/** …or flick faster than this, so a short quick swipe also closes it. */
const DISMISS_VELOCITY = 0.5; // px per ms

export function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn('sheet-overlay', className)}
      {...props}
    />
  );
}

/**
 * @param {object}   props
 * @param {string}   props.title        Accessible name, shown in the header.
 * @param {boolean}  props.dismissible  Allow scrim tap / drag / Escape.
 * @param {React.ReactNode} props.footer
 */
export function SheetContent({
  className, children, title, description, footer, dismissible = true, ...props
}) {
  const sheetRef = useRef(null);
  const drag = useRef({ active: false, startY: 0, startT: 0, dy: 0 });

  // The drag is pointer-based so one code path covers touch and mouse. It is
  // attached to the handle and header only — never the body, which scrolls.
  const onPointerDown = useCallback((e) => {
    if (!dismissible) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const node = sheetRef.current;
    if (!node) return;
    drag.current = { active: true, startY: e.clientY, startT: e.timeStamp, dy: 0 };
    node.classList.add('is-dragging');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }, [dismissible]);

  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    const node = sheetRef.current;
    if (!d.active || !node) return;
    // Downward only: dragging up must not lift the sheet off the bottom edge.
    d.dy = Math.max(0, e.clientY - d.startY);
    node.style.transform = `translateY(${d.dy}px)`;
  }, []);

  const endDrag = useCallback((e, cancelled) => {
    const d = drag.current;
    const node = sheetRef.current;
    if (!d.active || !node) return;
    d.active = false;
    node.classList.remove('is-dragging');

    const elapsed = Math.max(1, (e?.timeStamp ?? 0) - d.startT);
    const velocity = d.dy / elapsed;
    const shouldClose = !cancelled && (d.dy > DISMISS_PX || velocity > DISMISS_VELOCITY);

    if (shouldClose) {
      // Let the close animation take over from where the finger left it.
      node.style.transform = '';
      const closeBtn = node.querySelector('[data-slot="sheet-close"]');
      if (closeBtn) closeBtn.click();
    } else {
      node.style.transform = '';
    }
  }, []);

  const onPointerUp = useCallback((e) => endDrag(e, false), [endDrag]);
  const onPointerCancel = useCallback((e) => endDrag(e, true), [endDrag]);

  // A drag left mid-flight (component unmounting) must not leak inline styles.
  useEffect(() => () => { drag.current.active = false; }, []);

  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={sheetRef}
        data-slot="sheet-content"
        className={cn('sheet-content', className)}
        // Radix would otherwise close on a scrim tap even when locked.
        onPointerDownOutside={(e) => { if (!dismissible) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!dismissible) e.preventDefault(); }}
        {...props}
      >
        <div data-slot="sheet-handle" className="sheet-handle" {...dragProps}>
          <span />
        </div>

        <div data-slot="sheet-header" className="sheet-header" {...dragProps}>
          <SheetPrimitive.Title data-slot="sheet-title" className="sheet-title">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="sheet-close"
            aria-label="Close"
            // The close button sits inside the drag region; stop the gesture
            // from swallowing its tap.
            onPointerDown={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: I.x }}
          />
        </div>

        {/* Radix requires a description or an explicit opt-out. */}
        <SheetPrimitive.Description className="sr-only">
          {description || title}
        </SheetPrimitive.Description>

        <div data-slot="sheet-body" className="sheet-body">{children}</div>

        {footer ? (
          <div data-slot="sheet-footer" className="sheet-footer">{footer}</div>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}
