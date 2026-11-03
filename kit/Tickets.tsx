'use client';

// The Tickets tab: the list in queue order with its filters, and the open ticket docked beside it. On a narrow
// screen the ticket takes the whole width, with a way back to the list.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { announceChange, messageOf } from './api';
import { AgentIcon, BackIcon, CommentIcon, DownloadIcon, HistoryIcon, ClipIcon, PencilIcon, SearchIcon, SendIcon, TicketIcon, UploadIcon } from './icons';
import {
  ago,
  FILE_TYPES,
  filterTickets,
  isOpen,
  KIND_TONE,
  kindOf,
  KINDS,
  LIMITS,
  mayEdit,
  megabytes,
  NO_FILTERS,
  SEVERITIES,
  SEVERITY_TONE,
  severityOf,
  STATUSES,
  statusOf,
  when,
  whyNotMove,
  type FeedbackKind,
  type FeedbackSeverity,
  type StatusFilter,
  type Ticket,
  type TicketDraft,
  type TicketFilters,
  type TicketFull,
} from './model';
import { Avatar, Badge, Button, Dialog, EmptyState, KitLink, Notice, Skeleton, Tabs, useKit, type Theme } from './parts';
import { Strip } from './Strip';

export function TicketsTab({ tickets, number, onChanged, theme }: { tickets: Ticket[]; number: number | null; onChanged: (t: Ticket) => void; theme: Theme }) {
  const { areas } = useKit();
  const [filters, setFilters] = useState<TicketFilters>(NO_FILTERS);
  const shown = useMemo(() => filterTickets(tickets, filters), [tickets, filters]);
  const selected = number !== null ? (tickets.find((t) => t.number === number) ?? null) : null;
  const closed = tickets.filter((t) => !isOpen(t.status)).length;
  const usedAreas = useMemo(() => [...new Set(tickets.map((t) => t.area))].sort((a, b) => (areas.indexOf(a) + 1 || 999) - (areas.indexOf(b) + 1 || 999)), [tickets, areas]);

  useEffect(() => {
    // A ticket opened by its address shows in the list whatever the filter, so it is never open out of sight.
    if (selected && filterTickets([selected], filters).length === 0) setFilters({ ...NO_FILTERS, status: 'all' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <div className="fk-tickets">
      <Strip tickets={tickets} />
      <div className="fk-split" data-view={selected || number !== null ? 'detail' : 'list'}>
        <div className="fk-split__list">
          <Tabs
            label="Which tickets"
            value={filters.status}
            onChange={(status: StatusFilter) => setFilters({ ...filters, status })}
            items={[
              { id: 'open' as StatusFilter, label: 'Open', count: tickets.length - closed },
              { id: 'closed' as StatusFilter, label: 'Closed', count: closed },
              { id: 'all' as StatusFilter, label: 'All', count: tickets.length },
            ]}
          />
          <div className="fk-filters">
            <label className="fk-search">
              <SearchIcon size={15} />
              <span className="fk-sr">Search the tickets</span>
              <input className="fk-input" type="search" placeholder="Search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </label>
            <select className="fk-input" aria-label="What kind" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value as FeedbackKind | 'all' })}>
              <option value="all">Every kind</option>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <select className="fk-input" aria-label="How bad" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value as FeedbackSeverity | 'all' })}>
              <option value="all">Any severity</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="fk-input fk-filters__wide" aria-label="Part of the app" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
              <option value="all">Every part of the app</option>
              {usedAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <ul className="fk-cards">
            {shown.map((t, i) => (
              <li key={t.id} style={{ '--i': i } as React.CSSProperties}>
                <KitLink path={`tickets/${t.number}`} className="fk-card fk-spot" current={selected?.id === t.id}>
                  <span className="fk-card__top">
                    <span className="fk-num">{t.number}</span>
                    <span className="fk-card__title">{t.title}</span>
                  </span>
                  <span className="fk-card__badges">
                    <Badge tone={statusOf(t.status).tone}>{statusOf(t.status).label}</Badge>
                    <Badge tone={SEVERITY_TONE[t.severity]}>{severityOf(t.severity).label}</Badge>
                    <Badge tone={KIND_TONE[t.kind]}>{kindOf(t.kind).label}</Badge>
                  </span>
                  <CardMeta t={t} />
                </KitLink>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="fk-none">
                <span>No ticket matches.</span>
                <Button size="small" variant="quiet" onClick={() => setFilters(NO_FILTERS)}>
                  Show every open ticket
                </Button>
              </li>
            )}
          </ul>
        </div>
        <div className="fk-split__detail">
          {selected ? (
            <TicketDetail key={selected.id} ticket={selected} onChanged={onChanged} theme={theme} />
          ) : number !== null ? (
            <EmptyState icon={<TicketIcon size={28} />} action={<KitLink path="tickets" className="fk-btn" >Back to the tickets</KitLink>}>
              There is no ticket {number}.
            </EmptyState>
          ) : (
            <div className="fk-pick">
              <TicketIcon size={28} />
              <p>Open a ticket to read it, move it and comment on it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardMeta({ t }: { t: Ticket }) {
  const { nameOf } = useKit();
  return (
    <span className="fk-meta">
      {t.area} <span aria-hidden="true">·</span> {nameOf(t.filedBy)} <span aria-hidden="true">·</span> {ago(t.filedAt)}
    </span>
  );
}

// ---------- one ticket

export function TicketDetail({ ticket, onChanged, theme }: { ticket: Ticket; onChanged: (t: Ticket) => void; theme: Theme }) {
  const { api, me, nameOf, roleOf } = useKit();
  const [full, setFull] = useState<TicketFull | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [said, setSaid] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const ids = useId();

  const load = useCallback(async () => {
    try {
      setFull(await api.getTicket(ticket.id));
    } catch (err) {
      setProblem(messageOf(err));
    }
  }, [api, ticket.id]);

  useEffect(() => {
    void load();
    // Opening a ticket is reading what the bell says about it.
    void api
      .markRead(ticket.id)
      .then(announceChange)
      .catch(() => undefined);
  }, [api, load, ticket.id, ticket.updatedAt]);

  const act = async (key: string, run: () => Promise<void>) => {
    setBusy(key);
    setProblem(null);
    setSaid([]);
    try {
      await run();
      announceChange();
    } catch (err) {
      setProblem(messageOf(err));
    }
    setBusy(null);
  };

  const t = full?.ticket ?? ticket;
  const status = statusOf(t.status);

  return (
    <article className="fk-detail" aria-labelledby={`${ids}-title`}>
      <KitLink path="tickets" className="fk-back">
        <BackIcon size={14} /> Back to the list
      </KitLink>
      <header className="fk-detail__head">
        <p className="fk-eyebrow">
          Ticket {t.number} <span aria-hidden="true">·</span> {t.area}
        </p>
        <h2 className="fk-detail__title" id={`${ids}-title`}>
          {t.title}
        </h2>
        <div className="fk-card__badges">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={SEVERITY_TONE[t.severity]}>{severityOf(t.severity).label}</Badge>
          <Badge tone={KIND_TONE[t.kind]}>{kindOf(t.kind).label}</Badge>
        </div>
        <p className="fk-meta fk-detail__who">
          Filed by {nameOf(t.filedBy)}, {when(t.filedAt)}
          {t.statusBy && t.statusAt ? `. Moved to ${status.label} by ${nameOf(t.statusBy)}, ${when(t.statusAt)}.` : '.'}
        </p>
      </header>

      {problem && (
        <Notice tone="danger" title="That did not work." live>
          <p>{problem}</p>
        </Notice>
      )}
      {said.length > 0 && (
        <Notice tone="warning" title="Some files were not added." live>
          <ul className="fk-problems">
            {said.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Notice>
      )}

      <section className="fk-move" aria-label="Where it stands">
        <div className="fk-move__row" role="group" aria-label="Move it to">
          {STATUSES.map((s) => {
            const why = t.status === s.value ? null : whyNotMove(me, t, s.value);
            return (
              <button
                key={s.value}
                type="button"
                className="fk-move__step"
                data-status={s.value}
                aria-pressed={t.status === s.value}
                disabled={busy !== null || why !== null || t.status === s.value}
                title={why ?? undefined}
                onClick={() =>
                  void act('move', async () => {
                    onChanged(await api.moveTicket(t.id, s.value));
                    await load();
                  })
                }
              >
                <i className="fk-dot" aria-hidden="true" />
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="fk-help">{whyNotHere(me, t) ?? status.hint}</p>
      </section>

      <section className="fk-panel fk-body">
        <div className="fk-section__head">
          <h3 className="fk-section__title">What happened</h3>
          {mayEdit(t, me) && (
            <Button size="small" variant="quiet" onClick={() => setEditing(true)} icon={<PencilIcon size={14} />}>
              Change it
            </Button>
          )}
        </div>
        {t.body ? <p className="fk-body__text">{t.body}</p> : <p className="fk-meta">Nothing more is written.</p>}
        {(t.page || t.device) && (
          <p className="fk-meta fk-body__context">
            Filed from {[t.page, t.device].filter(Boolean).join(', ')}
          </p>
        )}
      </section>

      <section className="fk-section" aria-label="Files">
        <div className="fk-section__head">
          <h3 className="fk-section__title">
            <ClipIcon size={14} /> Files <span className="fk-meta">{full?.files.length ?? ''}</span>
          </h3>
          <Button size="small" variant="quiet" disabled={busy !== null} onClick={() => picker.current?.click()} icon={<UploadIcon size={14} />}>
            {busy === 'files' ? 'Adding' : 'Add files'}
          </Button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={FILE_TYPES.join(',')}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (picked.length === 0) return;
              void act('files', async () => {
                setSaid(await api.addFiles(t.id, picked));
                await load();
              });
            }}
          />
        </div>
        {full === null ? (
          <Skeleton height={40} radius={10} />
        ) : full.files.length === 0 ? (
          <p className="fk-meta">No file. A screenshot or a short screen recording is often the fastest way to show it.</p>
        ) : (
          <ul className="fk-files">
            {full.files.map((f) => (
              <li key={f.id}>
                <ClipIcon size={14} />
                <span className="fk-files__name">{f.name}</span>
                <span className="fk-meta">
                  {megabytes(f.bytes)} <span aria-hidden="true">·</span> {nameOf(f.addedBy)}
                </span>
                <Button
                  size="small"
                  variant="quiet"
                  disabled={busy !== null}
                  icon={<DownloadIcon size={14} />}
                  onClick={() => {
                    // The window opens on the press itself, or Safari blocks it; the file's link arrives a moment later.
                    const tab = window.open('', '_blank');
                    if (tab) tab.opener = null;
                    void act(`file-${f.id}`, async () => {
                      try {
                        const link = await api.fileLink(f);
                        if (tab) tab.location.href = link;
                        else window.location.assign(link);
                      } catch (err) {
                        tab?.close();
                        throw err;
                      }
                    });
                  }}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fk-section" aria-label="Comments">
        <h3 className="fk-section__title">
          <CommentIcon size={14} /> Comments <span className="fk-meta">{full?.comments.length ?? ''}</span>
        </h3>
        {full === null ? (
          <Skeleton height={60} radius={10} />
        ) : full.comments.length === 0 ? (
          <p className="fk-meta">No comment yet.</p>
        ) : (
          <ol className="fk-thread">
            {full.comments.map((c) => {
              const agent = roleOf(c.author) === 'agent';
              return (
                <li key={c.id} data-agent={agent || undefined}>
                  <Avatar name={nameOf(c.author)} agent={agent} />
                  <div>
                    <p className="fk-thread__who">
                      <strong>{nameOf(c.author)}</strong>
                      {agent && (
                        <span className="fk-agent-tag">
                          <AgentIcon size={12} /> Agent
                        </span>
                      )}
                      <span className="fk-meta">{when(c.at)}</span>
                    </p>
                    <p className="fk-thread__text">{c.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <form
          className="fk-say"
          onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            void act('comment', async () => {
              await api.addComment(t.id, comment);
              setComment('');
              await load();
            });
          }}
        >
          <label className="fk-sr" htmlFor={`${ids}-comment`}>
            Add a comment
          </label>
          <textarea id={`${ids}-comment`} className="fk-input fk-textarea" rows={3} maxLength={LIMITS.comment} value={comment} placeholder="Add a comment: what you tried, what you see now, or why it should wait." onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" disabled={busy !== null || !comment.trim()} icon={<SendIcon size={14} />}>
            {busy === 'comment' ? 'Adding it' : 'Comment'}
          </Button>
        </form>
      </section>

      {full && full.events.length > 0 && (
        <details className="fk-history">
          <summary>
            <HistoryIcon size={14} /> History <span className="fk-meta">{full.events.length}</span>
          </summary>
          <ol>
            {full.events.map((e) => (
              <li key={e.id}>
                <strong>{nameOf(e.actor)}</strong> {e.what}. <span className="fk-meta">{when(e.at)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {editing && (
        <EditDialog
          ticket={t}
          theme={theme}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            onChanged(await api.editTicket(t.id, patch));
            announceChange();
            await load();
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}

/** The line under the status row, when the person reading cannot do what the ticket now needs. */
function whyNotHere(me: Parameters<typeof whyNotMove>[0], t: Ticket): string | null {
  if (t.status !== 'in_review') return null;
  return whyNotMove(me, t, 'done');
}

function EditDialog({ ticket, onClose, onSave, theme }: { ticket: Ticket; onClose: () => void; onSave: (patch: Partial<TicketDraft>) => Promise<void>; theme: Theme }) {
  const { areas } = useKit();
  const [draft, setDraft] = useState<TicketDraft>({ title: ticket.title, body: ticket.body, area: ticket.area, kind: ticket.kind, severity: ticket.severity });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ids = useId();
  const choices = areas.includes(ticket.area) ? areas : [ticket.area, ...areas];
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onSave(draft);
    } catch (err) {
      setProblem(messageOf(err));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={`Change ticket ${ticket.number}`}
      onClose={onClose}
      theme={theme}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it as it is
          </Button>
          <Button variant="primary" disabled={busy || !draft.title.trim()} onClick={() => void save()}>
            {busy ? 'Saving' : 'Save the changes'}
          </Button>
        </>
      }
    >
      {problem && (
        <Notice tone="danger" title="It was not saved." live>
          <p>{problem}</p>
        </Notice>
      )}
      <div className="fk-field">
        <label className="fk-label" htmlFor={`${ids}-t`}>
          Title
        </label>
        <input id={`${ids}-t`} className="fk-input" maxLength={LIMITS.title} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div className="fk-field">
        <label className="fk-label" htmlFor={`${ids}-b`}>
          What happened
        </label>
        <textarea id={`${ids}-b`} className="fk-input fk-textarea" rows={6} maxLength={LIMITS.body} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
      </div>
      <div className="fk-row">
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-k`}>
            What kind
          </label>
          <select id={`${ids}-k`} className="fk-input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as FeedbackKind })}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-s`}>
            How bad
          </label>
          <select id={`${ids}-s`} className="fk-input" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as FeedbackSeverity })}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fk-field">
        <label className="fk-label" htmlFor={`${ids}-a`}>
          Part of the app
        </label>
        <select id={`${ids}-a`} className="fk-input" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
          {choices.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </Dialog>
  );
}
