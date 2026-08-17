/* ============================================================
   useAlertDialog — keeps the ergonomics of the old imperative
   `showDialog({ title, message, actions })` while rendering a
   real Radix AlertDialog.
   ------------------------------------------------------------
   Call sites stay one function call; the hook returns the element
   to drop into the page's JSX.
   ============================================================ */

import { useCallback, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { cn } from '@/lib/utils.js';

export function useAlertDialog() {
  const [state, setState] = useState(null);

  const showDialog = useCallback((opts) => setState(opts), []);
  const close = useCallback(() => setState(null), []);

  const dialog = (
    <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) close(); }}>
      {state ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.message ? (
              <AlertDialogDescription style={{ whiteSpace: 'pre-line' }}>
                {state.message}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {state.actions.map((a, i) => {
              // The last action is the confirming one; anything without an
              // onClick is a plain dismiss. Radix wants Cancel vs Action so it
              // knows what Escape maps to.
              const isDismiss = !a.onClick;
              const Btn = isDismiss ? AlertDialogCancel : AlertDialogAction;
              return (
                <Btn
                  key={a.label + i}
                  className={cn(a.danger && 'is-danger')}
                  onClick={() => { if (a.onClick) a.onClick(); }}
                >
                  {a.label}
                </Btn>
              );
            })}
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );

  return { showDialog, dialog };
}
