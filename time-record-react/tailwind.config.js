/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // IMPORTANT (phase 1): preflight is OFF.
  // `src/styles.css` is the untouched stable stylesheet from the legacy app and
  // already carries its own reset. Letting Tailwind's preflight run would change
  // the visual baseline, which this migration must not do. shadcn/ui components
  // still work — they only rely on utility classes, not on preflight.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      // The shadcn new-york-v4 components are authored for Tailwind v4 and use
      // a few utilities that do not exist in v3. Without these they compile to
      // nothing and the controls render subtly wrong (no border shadow, wrong
      // sizes), so define the v4 equivalents explicitly.
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      spacing: {
        7.5: '1.875rem', // 30px — colour swatch, matches the legacy .swatch
        8.5: '2.125rem', // 34px — chip min-height, matches the legacy .tpl-chip
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        border: 'hsl(var(--sh-border))',
        input: 'hsl(var(--sh-input))',
        ring: 'hsl(var(--sh-ring))',
        background: 'hsl(var(--sh-background))',
        foreground: 'hsl(var(--sh-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--sh-primary))',
          foreground: 'hsl(var(--sh-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--sh-secondary))',
          foreground: 'hsl(var(--sh-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--sh-destructive))',
          foreground: 'hsl(var(--sh-destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--sh-muted))',
          foreground: 'hsl(var(--sh-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--sh-accent))',
          foreground: 'hsl(var(--sh-accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--sh-popover))',
          foreground: 'hsl(var(--sh-popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--sh-card))',
          foreground: 'hsl(var(--sh-card-foreground))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // `field-sizing` ships in Tailwind v4; the shadcn v4 Textarea relies on it
    // to grow with its content. Provide it here so the component behaves as
    // authored. Browsers without support simply ignore the declaration.
    ({ addUtilities }) => {
      addUtilities({
        '.field-sizing-content': { 'field-sizing': 'content' },
        '.field-sizing-fixed': { 'field-sizing': 'fixed' },
      });
    },
  ],
};
