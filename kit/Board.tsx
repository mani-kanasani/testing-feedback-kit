'use client';

// The Board tab: five columns in the order a ticket moves. Drag a card, or use its two arrows. A column a person
// may not drop into says why while the card is over it. Done and Won't do show the newest six.
import { useState, type CSSProperties } from 'react';
import { announceChange, messageOf } from './api';
import { LeftIcon, RightIcon } from './icons';
import { isOpen, kindOf, queueOrder, SEVERITY_TONE, severityOf, STATUSES, statusOf, whyNotMove, type FeedbackStatus, type Ticket } from './model';
import { Badge, Button, KitLink, Notice, useKit } from './parts';
import { Strip } from './Strip';

const CLOSED_SHOWN = 6;

export function BoardTab({ tickets, onChanged }: { tickets: Ticket[]; onChanged: (t: Ticket) => void }) {
  const { api, me, nameOf } = useKit();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<FeedbackStatus | null>(null);
  const [all, setAll] = useState<Partial<Record<FeedbackStatus, boolean>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const dragged = tickets.find((t) => t.id === dragging) ?? null;

  const move = async (t: Ticket, to: FeedbackStatus) => {
    if (t.status === to) return;
    const why = whyNotMove(me, t, to);
    if (why) {
      setProblem(why);
      return;
    }
    setProblem(null);
    // The card moves at once, and goes back if the database says no.
    onChanged({ ...t, status: to, statusBy: me.email, statusAt: new Date().toISOString(), reviewBy: to === 'in_review' ? me.email : t.reviewBy });
    try {
      onChanged(await api.moveTicket(t.id, to));
      announceChange();
    } catch (err) {
      onChanged(t);
      setProblem(messageOf(err));
    }
  };

  return (
    <div className="fk-boardtab">
      <Strip tickets={tickets} />
      {problem && (
        <Notice tone="danger" title="It did not move." live>
          <p>{problem}</p>
        </Notice>
      )}
      <div className="fk-board" data-dragging={dragging !== null || undefined}>
        {STATUSES.map((column, index) => {
          const closed = !isOpen(column.value);
          const cards = tickets.filter((t) => t.status === column.value).sort(queueOrder);
          const shown = closed && !all[column.value] ? cards.slice(0, CLOSED_SHOWN) : cards;
          const before = STATUSES[index - 1]?.value;
          const after = STATUSES[index + 1]?.value;
          const refusal = dragged && dragged.status !== column.value ? whyNotMove(me, dragged, column.value) : null;
          return (
            <section
              key={column.value}
              className="fk-col"
              data-status={column.value}
              data-over={over === column.value || undefined}
              data-closed={closed || undefined}
              aria-label={`${column.label}, ${cards.length} ${cards.length === 1 ? 'ticket' : 'tickets'}`}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                if (over !== column.value) setOver(column.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const t = dragged;
                setDragging(null);
                setOver(null);
                if (t) void move(t, column.value);
              }}
            >
              <header className="fk-col__head">
                <div>
                  <h3 className="fk-col__title">
                    <i className="fk-dot" aria-hidden="true" />
                    {column.label}
                  </h3>
                  <p className="fk-col__help">{column.hint}</p>
                </div>
                <span className="fk-col__count" aria-hidden="true">
                  {cards.length}
                </span>
              </header>
              {dragging !== null && over === column.value && (
                <div className="fk-col__slot" data-refused={refusal !== null || undefined} aria-hidden="true">
                  {refusal ?? 'Drop it here'}
                </div>
              )}
              {cards.length === 0 && !(dragging !== null && over === column.value) && <p className="fk-col__empty">Nothing here.</p>}
              {shown.map((t, place) => {
                const back = before && !whyNotMove(me, t, before) ? before : null;
                const on = after && !whyNotMove(me, t, after) ? after : null;
                return (
                  <article
                    key={t.id}
                    className="fk-bcard fk-spot"
                    style={{ '--i': place } as CSSProperties}
                    draggable
                    data-status={column.value}
                    data-severity={t.severity}
                    data-dragging={dragging === t.id || undefined}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', t.id);
                      setDragging(t.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  >
                    <span className="fk-sheen" aria-hidden="true" />
                    <KitLink path={`tickets/${t.number}`} className="fk-bcard__open">
                      <span className="fk-bcard__top">
                        <span className="fk-num">{t.number}</span>
                        <Badge tone={SEVERITY_TONE[t.severity]}>{severityOf(t.severity).label}</Badge>
                      </span>
                      <span className="fk-bcard__title">{t.title}</span>
                      <span className="fk-meta">
                        {kindOf(t.kind).label} <span aria-hidden="true">·</span> {t.area} <span aria-hidden="true">·</span> {nameOf(t.filedBy)}
                      </span>
                    </KitLink>
                    <div className="fk-bcard__moves">
                      <button type="button" className="fk-icon-btn" disabled={!back} aria-label={back ? `Move "${t.title}" back to ${statusOf(back).label}` : 'It cannot move back from here'} onClick={() => back && void move(t, back)}>
                        <LeftIcon size={15} />
                      </button>
                      <button type="button" className="fk-icon-btn" disabled={!on} aria-label={on ? `Move "${t.title}" on to ${statusOf(on).label}` : 'It cannot move on from here'} onClick={() => on && void move(t, on)}>
                        <RightIcon size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {closed && cards.length > CLOSED_SHOWN && (
                <Button size="small" variant="quiet" onClick={() => setAll({ ...all, [column.value]: !all[column.value] })}>
                  {all[column.value] ? 'Show fewer' : `Show all ${cards.length}`}
                </Button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
