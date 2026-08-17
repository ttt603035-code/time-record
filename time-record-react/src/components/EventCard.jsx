import { EVENT_COLORS } from '@/lib/constants.js';

/** A single event row in the day detail list. Markup matches the legacy DOM. */
export function EventCard({ event, onClick }) {
  const e = event;
  const label = `${e.title}, ${e.startTime} to ${e.endTime}${e.category ? `, ${e.category}` : ''}`;

  return (
    <button
      className="event-card"
      type="button"
      aria-label={label}
      onClick={() => onClick(e.id)}
    >
      <span
        className="event-accent"
        style={{ '--c': EVENT_COLORS[e.color] || EVENT_COLORS.blue }}
      />
      <span className="event-time">
        <span className="t-start">{e.startTime}</span>
        <span className="t-end">{e.endTime}</span>
      </span>
      <span className="event-body">
        <span className="event-title">{e.title}</span>
        {e.category ? <span className="event-meta">{e.category}</span> : null}
        {e.note ? <span className="event-note">{e.note}</span> : null}
      </span>
      <span className="event-chevron">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
