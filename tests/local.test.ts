// The contract on the local adapter: five people sharing one store, as five tabs would.
import { describe, expect, it } from 'vitest';
import { createLocalApi, emptyState } from '../kit/local';
import type { FeedbackUser } from '../kit/model';
import { runContract } from './contract';

const people: FeedbackUser[] = [
  { email: 'alex@example.com', name: 'Alex', role: 'approver' },
  { email: 'jordan@example.com', name: 'Jordan', role: 'member' },
  { email: 'sam@example.com', name: 'Sam', role: 'member' },
  { email: 'agent@example.com', name: 'Claude (agent)', role: 'agent' },
];

function sharedStore() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

describe('the local adapter', () => {
  it('keeps the contract', async () => {
    const storage = sharedStore();
    const as = (email: string) => createLocalApi({ currentEmail: () => email, initial: () => emptyState(people), storage });
    const passed = await runContract({
      approver: as('alex@example.com'),
      member: as('jordan@example.com'),
      other: as('sam@example.com'),
      agent: as('agent@example.com'),
      stranger: as('nobody@example.com'),
      emails: { approver: 'alex@example.com', member: 'jordan@example.com', other: 'sam@example.com', agent: 'agent@example.com' },
    });
    expect(passed.length).toBeGreaterThanOrEqual(14);
  });

  it('keeps working in memory when the store refuses', async () => {
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const api = createLocalApi({ currentEmail: () => 'jordan@example.com', initial: () => emptyState(people), storage: refusing });
    const { ticket } = await api.fileTicket({ title: 'Still works', body: '', area: 'Something else', kind: 'bug', severity: 'low' }, []);
    expect((await api.listTickets()).map((t) => t.id)).toContain(ticket.id);
  });
});
