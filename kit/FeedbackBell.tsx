'use client';

// The bell, for your app's top bar. Red with a number while something is unread: a new ticket for an approver, and
// for whoever filed a ticket, every move and comment on it. Shown only to people on the list.
//
//   <FeedbackBell api={api} hrefFor={(p) => `/feedback/${p}`} onNavigate={(p) => router.push(`/feedback/${p}`)} />
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { announceChange, FEEDBACK_CHANGED, type FeedbackApi } from './api';
import { BellIcon } from './icons';
import { ago, nameFromEmail, noticeSays, type FeedbackNotice, type FeedbackUser } from './model';
import type { HrefFor, Theme } from './parts';

export interface FeedbackBellProps {
  api: FeedbackApi;
  hrefFor?: HrefFor;
  onNavigate?: (path: string) => void;
  theme?: Theme;
}

export function FeedbackBell({ api, hrefFor, onNavigate, theme = 'auto' }: FeedbackBellProps) {
  const [me, setMe] = useState<FeedbackUser | null>(null);
  const [lines, setLines] = useState<FeedbackNotice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  // The list opens under the bell, along its right edge. Where the bell sits near the left of a narrow screen, the list
  // is moved right until it fits.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    el.style.right = '0px';
    const left = el.getBoundingClientRect().left;
    if (left < 8) el.style.right = `${left - 8}px`;
  }, [open]);

  const load = useCallback(async () => {
    try {
      const who = await api.whoami();
      setMe(who);
      if (!who) return;
      const [notices, people] = await Promise.all([api.notices(), api.people()]);
      setLines(notices);
      setNames(Object.fromEntries(people.map((p) => [p.email, p.name])));
    } catch {
      // The bell stays quiet rather than break the top bar.
    }
  }, [api]);

  useEffect(() => {
    void load();
    const again = () => void load();
    window.addEventListener(FEEDBACK_CHANGED, again);
    window.addEventListener('focus', again);
    const timer = window.setInterval(() => document.visibilityState === 'visible' && again(), 60_000);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED, again);
      window.removeEventListener('focus', again);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) return null;
  const unread = lines.filter((n) => !n.read).length;
  const nameOf = (email: string) => names[email] ?? nameFromEmail(email);

  const follow = (e: MouseEvent<HTMLAnchorElement>, n: FeedbackNotice) => {
    void api
      .markRead(n.ticketId)
      .then(announceChange)
      .catch(() => undefined);
    setOpen(false);
    if (onNavigate && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      onNavigate(`tickets/${n.number}`);
    }
  };

  return (
    <div className="fk fk-bell" data-fk-theme={theme} ref={box}>
      <button type="button" className="fk-bell__button" aria-expanded={open} aria-controls={`${id}-list`} aria-label={unread ? `Feedback, ${unread} unread` : 'Feedback, nothing unread'} onClick={() => setOpen(!open)} data-unread={unread > 0 || undefined}>
        <BellIcon size={18} />
        {unread > 0 && <span className="fk-bell__count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="fk-bell__panel" id={`${id}-list`} ref={panel}>
          <header className="fk-bell__head">
            <strong>Feedback</strong>
            {unread > 0 && (
              <button
                type="button"
                className="fk-link-btn"
                onClick={() =>
                  void api
                    .markAllRead()
                    .then(() => {
                      announceChange();
                      return load();
                    })
                    .catch(() => undefined)
                }
              >
                Mark all as read
              </button>
            )}
          </header>
          {lines.length === 0 ? (
            <p className="fk-meta fk-bell__none">Nothing yet. A new ticket, and every move on a ticket you filed, shows here.</p>
          ) : (
            <ul className="fk-bell__list">
              {lines.slice(0, 20).map((n) => (
                <li key={n.ticketId} data-read={n.read || undefined}>
                  <a href={hrefFor ? hrefFor(`tickets/${n.number}`) : '#'} onClick={(e) => follow(e, n)}>
                    <span className="fk-bell__says">{noticeSays(n, nameOf)}</span>
                    <span className="fk-bell__title">
                      {n.number}. {n.title}
                    </span>
                    {n.note && <span className="fk-bell__note">{n.note}</span>}
                    <span className="fk-meta">{ago(n.at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
