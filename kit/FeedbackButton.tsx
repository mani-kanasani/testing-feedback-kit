'use client';

// The floating Feedback button. Put it once in your app's layout and it is on every page for everyone on the list,
// and on no page for anyone else. A ticket filed from it carries the page it was filed on (the path only, never the
// query string) and the screen size and browser.
//
//   <FeedbackButton api={api} areas={areas} area="Billing" hrefFor={(p) => `/feedback/${p}`} />
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { FEEDBACK_CHANGED, type FeedbackApi } from './api';
import { ChatIcon, CloseIcon } from './icons';
import { cleanPage, DEFAULT_AREAS, describeDevice, type FeedbackUser } from './model';
import { Notice, type HrefFor, type Theme } from './parts';
import { TicketForm, type Filed } from './TicketForm';

export interface FeedbackButtonProps {
  api: FeedbackApi;
  areas?: string[];
  /** The part of the app the person is on now, so the form starts there. */
  area?: string;
  /**
   * The page the person is on, when your app does not keep it in the path (a hash router, for example). Pass the
   * route only. By default the button takes window.location.pathname, never the query string or the part after #,
   * because sign-in links put tokens there.
   */
  page?: string;
  /** For the "Open it" link after filing. */
  hrefFor?: HrefFor;
  onNavigate?: (path: string) => void;
  label?: string;
  side?: 'right' | 'left';
  theme?: Theme;
}

export function FeedbackButton({ api, areas = DEFAULT_AREAS, area, page, hrefFor, onNavigate, label = 'Feedback', side = 'right', theme = 'auto' }: FeedbackButtonProps) {
  const [me, setMe] = useState<FeedbackUser | null>(null);
  const [open, setOpen] = useState(false);
  const [filed, setFiled] = useState<Filed | null>(null);
  const [context, setContext] = useState({ page: '/', device: '' });
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  // Who is signed in, read again whenever something changes (the Supabase adapter announces a sign-in or sign-out) and
  // when the window comes back, so the button follows the person and not the first page load.
  useEffect(() => {
    let live = true;
    const check = () =>
      api
        .whoami()
        .then((who) => live && setMe(who))
        .catch(() => live && setMe(null));
    void check();
    window.addEventListener(FEEDBACK_CHANGED, check);
    window.addEventListener('focus', check);
    return () => {
      live = false;
      window.removeEventListener(FEEDBACK_CHANGED, check);
      window.removeEventListener('focus', check);
    };
  }, [api]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        opener.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('input')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!me || typeof document === 'undefined') return null;

  const show = () => {
    setFiled(null);
    // Whatever is passed, a query string or a # part is cut off: sign-in links carry tokens there.
    setContext({ page: cleanPage(page ?? window.location.pathname) ?? '/', device: describeDevice(window.innerWidth, window.innerHeight, navigator.userAgent) });
    setOpen(true);
  };
  const openTicket = (e: MouseEvent<HTMLAnchorElement>, number: number) => {
    if (!onNavigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setOpen(false);
    onNavigate(`tickets/${number}`);
  };

  return createPortal(
    <div className="fk" data-fk-theme={theme}>
      <div className="fk-float" data-side={side} data-open={open || undefined}>
        {open && (
          <div ref={panel} className="fk-float__panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
            <header className="fk-float__head">
              <div>
                <h2 id={`${id}-title`}>File a ticket</h2>
                <p className="fk-help">The approvers are told. You are told as it moves.</p>
              </div>
              <button type="button" className="fk-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </header>
            <div className="fk-float__body">
              {filed ? (
                <div className="fk-float__done">
                  <Notice tone="success" title={`Ticket ${filed.ticket.number} is filed.`} live>
                    <p>Thank you. It is on the board now.</p>
                    {filed.problems.length > 0 && (
                      <ul className="fk-problems">
                        {filed.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </Notice>
                  <div className="fk-form__go">
                    {hrefFor && (
                      <a className="fk-btn" href={hrefFor(`tickets/${filed.ticket.number}`)} onClick={(e) => openTicket(e, filed.ticket.number)}>
                        Open it
                      </a>
                    )}
                    <button type="button" className="fk-btn" data-variant="primary" onClick={() => setFiled(null)}>
                      File another
                    </button>
                  </div>
                </div>
              ) : (
                <TicketForm api={api} areas={areas.length ? areas : DEFAULT_AREAS} area={area} context={context} compact onFiled={setFiled} filedAs={me.name} />
              )}
            </div>
          </div>
        )}
        <button ref={opener} type="button" className="fk-float__button" aria-expanded={open} onClick={() => (open ? setOpen(false) : show())}>
          <ChatIcon size={18} />
          <span>{label}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
