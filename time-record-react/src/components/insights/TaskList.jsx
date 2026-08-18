import { categoryNameOf, fmtTime, sessionsMeta } from '@/lib/analytics.js';

/** Task rows — ported from legacy `taskList`. */
export function TaskList({ tasks, hideCategory, onClick }) {
  return (
    <div className="task-list">
      {tasks.map((task) => {
        const metaText = hideCategory || task.categoryKey === '__none__'
          ? sessionsMeta(task.count)
          : `${categoryNameOf(task.categoryKey)} · ${sessionsMeta(task.count)}`;
        return (
          <button
            key={`${task.categoryKey}::${task.title}`}
            className="task-row"
            type="button"
            onClick={() => onClick(task)}
          >
            <span className="rank-dot" style={{ background: task.color }} />
            <span className="task-body">
              <span className="task-name">{task.title}</span>
              <span className="task-meta">{metaText}</span>
            </span>
            <span className="rank-time">{fmtTime(task.minutes)}</span>
            <span className="rank-chev">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
