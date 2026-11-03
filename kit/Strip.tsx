'use client';

// The strip above the list and the board: how many tickets are where, as numbers and as one bar.
import { statsOf, type Ticket } from './model';

export function Strip({ tickets }: { tickets: Ticket[] }) {
  const stats = statsOf(tickets);
  const cells = [
    { key: 'new', n: stats.new, label: 'New' },
    { key: 'in_progress', n: stats.inProgress, label: 'In progress' },
    { key: 'in_review', n: stats.inReview, label: 'In review' },
    { key: 'urgent', n: stats.urgent, label: 'High or critical, open' },
    { key: 'done', n: stats.done, label: 'Done' },
  ];
  return (
    <div className="fk-strip" role="group" aria-label="The tickets at a glance">
      <div className="fk-strip__cells">
        {cells.map((c) => (
          <p key={c.key} className="fk-strip__cell" data-status={c.key} data-zero={c.n === 0 || undefined}>
            <span className="fk-strip__n">{c.n}</span>
            <span className="fk-strip__label">
              <i className="fk-dot" aria-hidden="true" />
              {c.label}
            </span>
          </p>
        ))}
      </div>
      <div className="fk-strip__bar" aria-hidden="true">
        {cells
          .filter((c) => c.key !== 'urgent' && c.n > 0)
          .map((c) => (
            <span key={c.key} data-status={c.key} style={{ flexGrow: c.n }} />
          ))}
      </div>
    </div>
  );
}
