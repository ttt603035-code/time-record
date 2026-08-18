import { t } from '@/lib/i18n.js';

export function ChartCard({ children, className }) {
  return <section className={`chart-card${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function ChartTitle({ children }) {
  return <h3 className="chart-title">{children}</h3>;
}

export function ChartEmpty({ text }) {
  return <div className="chart-empty">{text || t('noData')}</div>;
}
