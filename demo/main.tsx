// The demo: an invented app called Harbor with the kit added the way INSTALL.md adds it to yours. The page on its own
// route, the button on every page, the bell in the top bar. It runs on the local adapter, so there is nothing to set
// up, and a switch at the top lets you be the approver, a client testing the app, or the agent.
//
// For pictures: ?as=agent|client|approver, ?theme=light|dark, ?open=button|bell
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FEEDBACK_CHANGED, FeedbackBell, FeedbackButton, FeedbackPage, createLocalApi, useHashPath, isOpen } from '../kit';
import '../kit/feedback.css';
import './demo.css';
import { demoState, PEOPLE } from './seed';

const AREAS = ['Dashboard', 'Jobs', 'Customers', 'Billing', 'Something else'];
const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'customers', label: 'Customers' },
  { id: 'billing', label: 'Billing' },
];
const params = new URLSearchParams(window.location.search);
const AS: Record<string, string> = { approver: PEOPLE[0].email, client: PEOPLE[1].email, member: PEOPLE[2].email, agent: PEOPLE[3].email };

let currentEmail = AS[params.get('as') ?? ''] ?? (() => {
  try {
    return localStorage.getItem('feedback-kit-demo:as') ?? PEOPLE[0].email;
  } catch {
    return PEOPLE[0].email;
  }
})();

const api = createLocalApi({ currentEmail: () => currentEmail, initial: demoState, storageKey: 'feedback-kit-demo' });

function App() {
  const feedback = useHashPath('feedback');
  const [me, setMe] = useState(currentEmail);
  const [theme, setTheme] = useState<'dark' | 'light'>(params.get('theme') === 'light' ? 'light' : 'dark');
  const [hostPage, setHostPage] = useState(() => window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard');
  const [version, setVersion] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const changed = () => setTick((t) => t + 1);
    window.addEventListener(FEEDBACK_CHANGED, changed);
    return () => window.removeEventListener(FEEDBACK_CHANGED, changed);
  }, []);

  useEffect(() => {
    const onHash = () => setHostPage(window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const open = params.get('open');
    if (!open) return;
    const timer = window.setTimeout(() => document.querySelector<HTMLButtonElement>(open === 'bell' ? '.fk-bell__button' : '.fk-float__button')?.click(), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const switchTo = (email: string) => {
    currentEmail = email;
    try {
      localStorage.setItem('feedback-kit-demo:as', email);
    } catch {
      // A private window: the choice lasts until the page reloads.
    }
    setMe(email);
    setVersion((v) => v + 1);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const open = useMemo(() => api.state().tickets.filter((t) => isOpen(t.status)).length, [version, tick, feedback.path]);
  const page = PAGES.find((p) => p.id === hostPage);
  const area = page ? page.label : feedback.onPage ? undefined : 'Something else';

  return (
    <div className="demo">
      <aside className="demo__side">
        <a className="demo__brand" href="#/dashboard">
          <span className="demo__mark" aria-hidden="true">H</span>
          Harbor
        </a>
        <nav aria-label="Harbor">
          {PAGES.map((p) => (
            <a key={p.id} href={`#/${p.id}`} aria-current={!feedback.onPage && hostPage === p.id ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
          <a href="#/feedback" aria-current={feedback.onPage ? 'page' : undefined}>
            Testing and feedback <span className="demo__count">{open}</span>
          </a>
        </nav>
        <p className="demo__note">An invented app with the kit added. Everything is kept in this browser.</p>
      </aside>

      <div className="demo__main">
        <header className="demo__top">
          <label className="demo__as">
            <span>Viewing as</span>
            <select value={me} onChange={(e) => switchTo(e.target.value)}>
              {PEOPLE.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name}, {p.role === 'member' && p.email.endsWith('client.test') ? 'a client testing' : p.role}
                </option>
              ))}
            </select>
          </label>
          <div className="demo__tools">
            <button type="button" className="demo__ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              className="demo__ghost"
              onClick={() => {
                api.reset();
                window.location.reload();
              }}
            >
              Reset the demo
            </button>
            <FeedbackBell key={`bell-${version}`} api={api} hrefFor={feedback.hrefFor} onNavigate={feedback.go} theme={theme} />
          </div>
        </header>

        <main className="demo__content">
          {feedback.onPage ? (
            <FeedbackPage key={`page-${version}`} api={api} appName="Harbor" areas={AREAS} path={feedback.path} onNavigate={feedback.go} hrefFor={feedback.hrefFor} theme={theme} />
          ) : (
            <HostPage title={page?.label ?? 'Dashboard'} />
          )}
        </main>
      </div>

      <FeedbackButton key={`button-${version}-${hostPage}`} api={api} areas={AREAS} area={area} page={`/${hostPage}`} hrefFor={feedback.hrefFor} onNavigate={feedback.go} theme={theme} />
    </div>
  );
}

function HostPage({ title }: { title: string }) {
  return (
    <div className="demo__page">
      <p className="demo__eyebrow">Harbor</p>
      <h1>{title}</h1>
      <p className="demo__lead">This stands in for a page of your own app. Press Feedback at the bottom right to file a ticket from here: it carries this page and your screen size, and goes on the board.</p>
      <div className="demo__tiles">
        {['Open jobs', 'Due this week', 'Waiting on a customer', 'Paid this month'].map((label, i) => (
          <div key={label} className="demo__tile">
            <span>{label}</span>
            <strong>{[42, 17, 6, 128][i]}</strong>
          </div>
        ))}
      </div>
      <div className="demo__rows">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="demo__row">
            <span className="demo__bar" style={{ width: `${70 - i * 9}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
