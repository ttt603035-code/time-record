import { COLOR_ORDER, EVENT_COLORS, isCustomColor, normalizeColorValue, resolveColor } from '@/lib/constants.js';
import { t } from '@/lib/i18n.js';
import { cn } from '@/lib/utils.js';

/**
 * The colour picker, shared by the event form and the template form.
 *
 * Named swatches stay the original Apple-muted palette. A native
 * `<input type="color">` sits at the end so iPhone can open its system
 * colour picker for categories that would otherwise collide.
 */
export function ColorSwatches({ value, onChange }) {
  const customOn = isCustomColor(value);
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
      <label
        className={cn(
          'swatch swatch-custom relative inline-flex size-[30px] items-center justify-center overflow-hidden rounded-full',
          customOn && 'scale-110 ring-2 ring-offset-2 ring-offset-background',
        )}
        aria-label={t('pickColor')}
        style={customOn ? { background: value, '--tw-ring-color': value } : undefined}
      >
        <input
          type="color"
          value={resolveColor(value)}
          aria-label={t('pickColor')}
          onChange={(e) => onChange(normalizeColorValue(e.target.value))}
        />
      </label>
    </div>
  );
}
