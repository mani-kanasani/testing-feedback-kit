'use client';

// The People tab, for approvers: who is on the feedback list and what they may do. Add the people who test your app,
// and the agents that work the tickets. Their tickets and comments stay when they are taken off.
import { useId, useState, type FormEvent } from 'react';
import { messageOf } from './api';
import { AgentIcon, PlusIcon } from './icons';
import { ROLES, roleOf, type FeedbackRole, type FeedbackUser } from './model';
import { Avatar, Badge, Button, Dialog, Notice, useKit, type Theme } from './parts';

export function PeopleTab({ people, onChanged, theme }: { people: FeedbackUser[]; onChanged: () => Promise<void>; theme: Theme }) {
  const { api, me } = useKit();
  const [draft, setDraft] = useState<FeedbackUser>({ email: '', name: '', role: 'member' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notRemoved, setNotRemoved] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<FeedbackUser | null>(null);
  const ids = useId();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!api.addPerson) return;
    setBusy(true);
    setProblem(null);
    setAdded(null);
    try {
      await api.addPerson(draft);
      await onChanged();
      setAdded(`${draft.name || draft.email} is on the list as ${roleOf(draft.role).label.toLowerCase()}.`);
      setDraft({ email: '', name: '', role: 'member' });
    } catch (err) {
      setProblem(messageOf(err));
    }
    setBusy(false);
  };

  const groups: Array<[FeedbackRole, FeedbackUser[]]> = ROLES.map((r) => [r.value, people.filter((p) => p.role === r.value)]);

  return (
    <div className="fk-people">
      <section className="fk-panel">
        <h2 className="fk-section__title">On the list</h2>
        <p className="fk-help">Everyone here sees every ticket, and each other's names and addresses. Someone signs in with the address on this list, and nothing else is needed.</p>
        {notRemoved && (
          <Notice tone="danger" title="Nobody was taken off." live>
            <p>{notRemoved}</p>
          </Notice>
        )}
        {groups.map(([role, list]) =>
          list.length === 0 ? null : (
            <div key={role} className="fk-people__group">
              <p className="fk-eyebrow">{roleOf(role).label}s</p>
              <ul className="fk-people__list">
                {list.map((p) => (
                  <li key={p.email}>
                    <Avatar name={p.name} agent={p.role === 'agent'} />
                    <span className="fk-people__who">
                      <strong>{p.name}</strong>
                      <span className="fk-meta">{p.email}</span>
                    </span>
                    {p.role === 'agent' && (
                      <Badge tone="info">
                        <AgentIcon size={12} /> Agent
                      </Badge>
                    )}
                    {p.email === me.email && <Badge>You</Badge>}
                    {api.removePerson && (
                      <Button size="small" variant="quiet" onClick={() => setLeaving(p)}>
                        Take off
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </section>

      <form className="fk-panel fk-form" onSubmit={add} noValidate>
        <h2 className="fk-section__title">Add someone</h2>
        {added && (
          <Notice tone="success" title="Added." live>
            <p>{added}</p>
          </Notice>
        )}
        {problem && (
          <Notice tone="danger" title="Nobody was added." live>
            <p>{problem}</p>
          </Notice>
        )}
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-email`}>
            Email address
          </label>
          <input id={`${ids}-email`} className="fk-input" type="email" autoComplete="off" value={draft.email} placeholder="The address they sign in with" onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </div>
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-name`}>
            Name
          </label>
          <input id={`${ids}-name`} className="fk-input" autoComplete="off" value={draft.name} placeholder="How the tickets show them" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <fieldset className="fk-field fk-kinds">
          <legend className="fk-label">Role</legend>
          <div className="fk-choice">
            {ROLES.map((r) => (
              <label key={r.value} className="fk-choice__item">
                <input type="radio" name={`${ids}-role`} value={r.value} checked={draft.role === r.value} onChange={() => setDraft({ ...draft, role: r.value })} />
                <strong>{r.label}</strong>
                <span>{r.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="fk-form__go">
          <Button type="submit" variant="primary" disabled={busy || !draft.email.trim()} icon={<PlusIcon size={16} />}>
            {busy ? 'Adding' : 'Add to the list'}
          </Button>
        </div>
      </form>

      {leaving && (
        <Dialog
          title={`Take ${leaving.name} off the list?`}
          onClose={() => setLeaving(null)}
          theme={theme}
          actions={
            <>
              <Button variant="quiet" onClick={() => setLeaving(null)}>
                Keep them
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    setNotRemoved(null);
                    try {
                      await api.removePerson?.(leaving.email);
                      await onChanged();
                    } catch (err) {
                      setNotRemoved(messageOf(err));
                    }
                    setBusy(false);
                    setLeaving(null);
                  })()
                }
              >
                Take them off
              </Button>
            </>
          }
        >
          <p className="fk-help">They stop seeing the tickets at once. What they filed and wrote stays, under their address.</p>
        </Dialog>
      )}
    </div>
  );
}
