/* ============================================================
   Alert dialog — shadcn/ui AlertDialog (Radix) wearing the app's
   existing iOS-style alert skin.
   ------------------------------------------------------------
   The visual design is deliberately unchanged: a centred blurred
   card with full-width stacked action rows is what iOS actually
   looks like, and shadcn's default side-by-side footer is not.
   What Radix adds is the behaviour the imperative version never
   had — a real focus trap, scroll locking, and focus restore.
   ============================================================ */

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils.js';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export function AlertDialogOverlay({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn('dialog-overlay', className)}
      {...props}
    />
  );
}

export function AlertDialogContent({ className, children, ...props }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn('dialog', className)}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader({ className, ...props }) {
  return <div data-slot="alert-dialog-header" className={cn('dialog-body', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('dialog-title', className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('dialog-message', className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({ className, ...props }) {
  return (
    <div data-slot="alert-dialog-footer" className={cn('dialog-actions', className)} {...props} />
  );
}
