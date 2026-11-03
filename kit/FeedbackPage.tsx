'use client';

// The whole page: File a ticket, Tickets, Board, and People for approvers. Put it on one route of your app.
//
//   <FeedbackPage api={api} areas={['Dashboard', 'Billing', 'Something else']} path={rest} onNavigate={go} hrefFor={(p) => `/feedback/${p}`} />
//
// path is the part of the address after the page's own: "", "tickets", "tickets/12", "board" or "people". Leave
// path and onNavigate out and the page keeps its own place. See INSTALL.md for each router.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FEEDBACK_CHANGED, messageOf, type FeedbackApi } from './api';
import { BoardIcon, ListIcon, PeopleIcon, TicketIcon } from './icons';
import { DEFAULT_AREAS, isOpen, STATUSES, type FeedbackUser, type Ticket } from './model';
import { Badge, EmptyState, Kit, KitLink, namesFrom, Notice, Skeleton, Tabs, useSpotlight, type HrefFor, type KitContext, type Theme } from './parts';
import { BoardTab } from './Board';
import { PeopleTab } from './People';
import { TicketForm, type Filed } from './TicketForm';
import { TicketsTab } from './Tickets';

type Tab = 'file' | 'tickets' | 'board' | 'people';

export interface FeedbackPageProps {
  api: FeedbackApi;
  /** The parts of your app a ticket can be about: your menu's items, then "Something else". */
  areas?: string[];
  /** Shown above the title, for example your app's name. */
  appName?: string;
  /** Where on the page we are. Leave out to let the page keep its own place. */
  path?: string;
  onNavigate?: (path: string) => void;
  /** Turns a page path into a real address, so links open in a new tab. */
  hrefFor?: HrefFor;
  theme?: Theme;
}

export function parsePath(path: string): { tab: Tab; number: number | null } {
  const [head, second] = path.replace(/^\/+|\/+$/g, '').split('/');
  if (head === 'tickets') return { tab: 'tickets', number: second && /^\d+$/.test(second) ? Number(second) : null };
  if (head === 'board') return { tab: 'board', number: null };
  if (head === 'people') return { tab: 'people', number: null };
  return { tab: 'file', number: null };
}

type Read =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'outside' }
  | { state: 'ready'; me: FeedbackUser; people: FeedbackUser[]; tickets: Ticket[] };

export function FeedbackPage({ api, areas = DEFAULT_AREAS, appName, path, onNavigate, hrefFor, theme = 'auto' }: FeedbackPageProps) {
  const [ownPath, setOwnPath] = useState('');
  const where = path ?? ownPath;
  const go = useCallback((next: string) => (onNavigate ? onNavigate(next) : setOwnPath(next)), [onNavigate]);
  const { tab, number } = parsePath(where);
  const [read, setRead] = useState<Read>({ state: 'loading' });
  const [filed, setFiled] = useState<Filed | null>(null);
  const asked = useRef(0);
  const spotlight = useSpotlight();

  const load = useCallback(async () => {
    const mine = ++asked.current;
    try {
      const me = await api.whoami();
      if (!me) {
        if (mine === asked.current) setRead({ state: 'outside' });
        return;
      }
      const [people, tickets] = await Promise.all([api.people(), api.listTickets()]);
      if (mine === asked.current) setRead({ state: 'ready', me, people, tickets });
    } catch (err) {
      if (mine === asked.current) setRead({ state: 'error', message: messageOf(err) });
    }
  }, [api]);

  useEffect(() => {
    void load();
    // Read again when something changes elsewhere, when the tab comes back, and every minute while it is in view.
    const again = () => void load();
    const onVisible = () => document.visibilityState === 'visible' && again();
    window.addEventListener(FEEDBACK_CHANGED, again);
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => document.visibilityState === 'visible' && again(), 60_000);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED, again);
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [load]);

  const ready = read.state === 'ready' ? read : null;
  const kit = useMemo<KitContext | null>(() => {
    if (!ready) return null;
    return { api, me: ready.me, ...namesFrom(ready.people), areas: areas.length ? areas : DEFAULT_AREAS, hrefFor, go };
  }, [api, ready, areas, hrefFor, go]);

  // A changed ticket takes its new place at once; the list is read again behind it.
  const changed = (ticket: Ticket) => {
    setRead((was) => (was.state === 'ready' ? { ...was, tickets: was.tickets.some((t) => t.id === ticket.id) ? was.tickets.map((t) => (t.id === ticket.id ? ticket : t)) : [ticket, ...was.tickets] } : was));
  };

  const tickets = ready?.tickets ?? [];
  const open = tickets.filter((t) => isOpen(t.status)).length;
  const showPeople = ready?.me.role === 'approver' && Boolean(api.addPerson);
  const tabs: Array<{ id: Tab; label: string; count?: number; icon: ReactNode }> = [
    { id: 'file', label: 'File a ticket', icon: <TicketIcon size={15} /> },
    { id: 'tickets', label: 'Tickets', count: ready ? open : undefined, icon: <ListIcon size={15} /> },
    { id: 'board', label: 'Board', icon: <BoardIcon size={15} /> },
    ...(showPeople ? [{ id: 'people' as Tab, label: 'People', count: ready?.people.length, icon: <PeopleIcon size={15} /> }] : []),
  ];
  const shownTab = tab === 'people' && !showPeople ? 'file' : tab;

  let body: ReactNode;
  if (read.state === 'loading') body = <Loading />;
  else if (read.state === 'error') {
    body = (
      <Notice tone="danger" title="The tickets could not be read." live>
        <p>{read.message}</p>
        <p>
          <button type="button" className="fk-btn" data-size="small" onClick={() => void load()}>
            Try again
          </button>
        </p>
      </Notice>
    );
  } else if (read.state === 'outside') {
    body = (
      <EmptyState icon={<TicketIcon size={28} />}>
        You are not on the feedback list for this app. Ask an approver to add the address you signed in with, then open this page again.
      </EmptyState>
    );
  } else if (kit) {
    if (shownTab === 'file') {
      body = (
        <div className="fk-file">
          <div className="fk-panel">
            <h2 className="fk-section__title">File a ticket</h2>
            <p className="fk-help">A bug, a change to something that works, or something new. The approvers are told, and you are told as it moves.</p>
            {filed && (
              <Notice tone="success" title={`Ticket ${filed.ticket.number} is filed.`} live>
                <p>
                  <KitLink path={`tickets/${filed.ticket.number}`}>Open it</KitLink>, or file another below.
                </p>
                {filed.problems.length > 0 && (
                  <ul className="fk-problems">
                    {filed.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </Notice>
            )}
            <TicketForm
              api={api}
              areas={kit.areas}
              filedAs={kit.me.name}
              onFiled={(f) => {
                setFiled(f);
                changed(f.ticket);
              }}
            />
          </div>
          <aside className="fk-how" aria-label="How a ticket moves">
            <p className="fk-eyebrow">How a ticket moves</p>
            <ol>
              {STATUSES.map((s) => (
                <li key={s.value} data-status={s.value}>
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span>{s.hint}</span>
                </li>
              ))}
            </ol>
            <p className="fk-help">Agents read the open tickets as their work, say what they changed, and move a ticket to In review. Only a person marks it Done, after testing it again.</p>
          </aside>
        </div>
      );
    } else if (tickets.length === 0 && shownTab !== 'people') {
      body = (
        <EmptyState
          icon={<TicketIcon size={28} />}
          action={
            <KitLink path="" className="fk-btn" >
              File the first ticket
            </KitLink>
          }
        >
          No ticket yet. When something is broken, or you want the app to do something new, file it and it is tracked until it is done.
        </EmptyState>
      );
    } else if (shownTab === 'tickets') body = <TicketsTab tickets={tickets} number={number} onChanged={changed} theme={theme} />;
    else if (shownTab === 'board') body = <BoardTab tickets={tickets} onChanged={changed} />;
    else body = <PeopleTab people={ready!.people} onChanged={load} theme={theme} />;
  }

  const page = (
    <div className="fk fk-page" data-fk-theme={theme} onPointerMove={spotlight}>
      <header className="fk-page__head">
        {appName && <p className="fk-eyebrow">{appName}</p>}
        <h1 className="fk-page__title">Testing and feedback</h1>
        <p className="fk-page__lead">Tell the team what is broken, what should change and what to build next. Every ticket is kept, moves across the board, and is tested again by a person before it is called done.</p>
      </header>
      <div className="fk-page__tabs">
        <Tabs label="Testing and feedback" value={shownTab} onChange={(id) => go(id === 'file' ? '' : id)} items={tabs} />
      </div>
      <div className="fk-page__body" key={shownTab}>
        {body}
      </div>
    </div>
  );
  return kit ? <Kit.Provider value={kit}>{page}</Kit.Provider> : page;
}

function Loading() {
  return (
    <div className="fk-loading" aria-busy="true">
      <span className="fk-sr" role="status">
        Reading the tickets
      </span>
      <Skeleton height={86} radius={16} />
      <div className="fk-loading__row">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={96} radius={12} />
        ))}
      </div>
    </div>
  );
}
