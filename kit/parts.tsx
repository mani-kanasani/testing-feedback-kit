'use client';

// The small pieces every screen of the kit uses: a badge, a button, a notice, a dialog, a skeleton, tabs, and the link
// that works with any router. Classes start with fk- so they never meet your app's own.
import { createContext, useCallback, useContext, useEffect, useId, useRef, type ButtonHTMLAttributes, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FeedbackApi } from './api';
import { CloseIcon } from './icons';
import { nameFromEmail, type FeedbackRole, type FeedbackTone, type FeedbackUser } from './model';

export type Theme = 'dark' | 'light' | 'auto';

/** Where the kit's own addresses go. "tickets/12" becomes, for example, "/feedback/tickets/12" or "#/feedback/tickets/12". */
export type HrefFor = (path: string) => string;

export interface KitContext {
  api: FeedbackApi;
  me: FeedbackUser;
  nameOf: (email: string | null) => string;
  roleOf: (email: string | null) => FeedbackRole | null;
  areas: string[];
  hrefFor?: HrefFor;
  go: (path: string) => void;
}

export const Kit = createContext<KitContext | null>(null);

export function useKit(): KitContext {
  const kit = useContext(Kit);
  if (!kit) throw new Error('A feedback screen was used outside <FeedbackPage>.');
  return kit;
}

export function namesFrom(people: FeedbackUser[]) {
  const byEmail = new Map(people.map((p) => [p.email, p]));
  return {
    nameOf: (email: string | null) => (email ? (byEmail.get(email)?.name ?? nameFromEmail(email)) : 'Someone'),
    roleOf: (email: string | null) => (email ? (byEmail.get(email)?.role ?? null) : null),
  };
}

/** A real link when your app gives addresses, so it opens in a new tab with a middle click; otherwise a plain jump. */
export function KitLink({ path, className, children, label, current }: { path: string; className?: string; children: ReactNode; label?: string; current?: boolean }) {
  const { hrefFor, go } = useKit();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(path);
  };
  return (
    <a className={className} href={hrefFor ? hrefFor(path) : '#'} onClick={onClick} aria-label={label} aria-current={current ? 'true' : undefined}>
      {children}
    </a>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: FeedbackTone; children: ReactNode }) {
  return (
    <span className="fk-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Button({ variant = 'default', size = 'normal', icon, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'quiet' | 'danger'; size?: 'normal' | 'small'; icon?: ReactNode }) {
  return (
    <button type="button" className={`fk-btn${className ? ` ${className}` : ''}`} data-variant={variant} data-size={size} {...rest}>
      {icon}
      {children !== undefined && <span>{children}</span>}
    </button>
  );
}

export function Notice({ tone, title, children, live }: { tone: 'success' | 'warning' | 'danger' | 'info'; title: string; children?: ReactNode; live?: boolean }) {
  return (
    <div className="fk-notice" data-tone={tone} role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
      <p className="fk-notice__title">{title}</p>
      {children && <div className="fk-notice__body">{children}</div>}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: number | string; radius?: number }) {
  return <span className="fk-skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}

export function Tabs<T extends string>({ value, items, onChange, label }: { value: T; items: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>; onChange: (id: T) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (from: number, step: number) => {
    const next = (from + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  return (
    <div className="fk-tabs" role="tablist" aria-label={label}>
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          aria-label={item.count !== undefined ? `${item.label}, ${item.count}` : undefined}
          tabIndex={item.id === value ? 0 : -1}
          className="fk-tab"
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(i, 1);
            if (e.key === 'ArrowLeft') move(i, -1);
          }}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.count !== undefined && <span className="fk-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="fk-empty">
      <span className="fk-empty__icon">{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Avatar({ name, agent }: { name: string; agent?: boolean }) {
  const letters = name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="fk-avatar" data-agent={agent || undefined} aria-hidden="true">
      {letters || '?'}
    </span>
  );
}

/** A dialog in a portal, so no parent's overflow or transform can clip it. Escape and the backdrop close it. */
export function Dialog({ title, onClose, children, actions, theme = 'auto' }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; theme?: Theme }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  // The latest onClose, so the dialog opens once and never moves focus again while someone types, however often the
  // page around it renders.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab' && box.current) {
        const focusable = Array.from(box.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, textarea, select'));
        if (focusable.length === 0) return;
        const [head, tail] = [focusable[0], focusable[focusable.length - 1]];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="fk" data-fk-theme={theme}>
      <div className="fk-overlay" onMouseDown={(e) => e.target === e.currentTarget && close.current()}>
        <div ref={box} className="fk-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          <header className="fk-dialog__head">
            <h2 id={`${id}-title`}>{title}</h2>
            <button type="button" className="fk-icon-btn" data-close onClick={() => close.current()} aria-label="Close">
              <CloseIcon />
            </button>
          </header>
          <div className="fk-dialog__body">{children}</div>
          {actions && <footer className="fk-dialog__foot">{actions}</footer>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The light that follows the pointer across a card. One listener for the whole screen. */
export function useSpotlight() {
  return useCallback((e: PointerEvent<HTMLElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.fk-spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
}
