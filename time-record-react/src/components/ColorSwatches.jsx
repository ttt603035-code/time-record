import { COLOR_ORDER, EVENT_COLORS } from '@/lib/constants.js';
import { cn } from '@/lib/utils.js';

/**
 * The colour picker, shared by the event form and the template form.
 *
 * Extracted during the phase-2 shadcn work: both forms had their own copy of
 * this markup and selection logic. Wraps onto multiple rows now that the
 * palette covers the full set of Apple system colours.
 */
export function ColorSwatches({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {COLOR_ORDER.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-label={'Color ' + c}
            aria-pressed={on}
            onClick={() => onChange(c)}
            className={cn(
              'inline-flex size-[30px] items-center justify-center rounded-full text-white transition-transform',
              'active:scale-90',
              on && 'scale-110 ring-2 ring-offset-2 ring-offset-background',
            )}
            style={{
              background: EVENT_COLORS[c],
              ...(on ? { '--tw-ring-color': EVENT_COLORS[c] } : null),
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
          </button>
        );
      })}
    </div>
  );
}
