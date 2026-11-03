// The demo's invented team and tickets. Nothing here is a real person, company or project.
import { emptyState, seedTicket, type LocalState } from '../kit/local';
import type { FeedbackUser } from '../kit/model';

export const PEOPLE: FeedbackUser[] = [
  { email: 'alex@harbor.test', name: 'Alex Rivera', role: 'approver' },
  { email: 'jordan@client.test', name: 'Jordan Lee', role: 'member' },
  { email: 'sam@harbor.test', name: 'Sam Patel', role: 'member' },
  { email: 'agent@harbor.test', name: 'Claude (agent)', role: 'agent' },
];

const [ALEX, JORDAN, SAM, AGENT] = PEOPLE.map((p) => p.email);

export function demoState(): LocalState {
  const s = emptyState(PEOPLE);

  const reset = seedTicket(s, { title: 'Password reset link opens a blank page on iPhone', body: 'Tapped the link in the reset email on my phone. The page stayed white. On my laptop the same link works.', area: 'Something else', kind: 'bug', severity: 'critical', by: JORDAN, daysAgo: 12, page: '/reset', device: '390 by 844, Safari on iOS' }, [
    { to: 'in_progress', by: SAM, hoursLater: 2 },
    { to: 'in_review', by: SAM, hoursLater: 20, note: 'The page waited for a script Safari blocks in private mode. It loads without it now.' },
    { to: 'done', by: ALEX, hoursLater: 40, note: 'Tested on two iPhones and an Android phone. Works.' },
  ], [{ by: JORDAN, hoursLater: 30, body: 'Works on my phone now.' }]);

  seedTicket(s, { title: 'Rename Clients to Customers everywhere', body: 'The menu says Customers and the pages say Clients. Pick one.', area: 'Customers', kind: 'change', severity: 'low', by: ALEX, daysAgo: 14 }, [
    { to: 'in_progress', by: AGENT, hoursLater: 3 },
    { to: 'in_review', by: AGENT, hoursLater: 4, note: 'Changed 23 places in 9 files. Pull request 41. Live after the next deploy.' },
    { to: 'done', by: JORDAN, hoursLater: 50 },
  ]);

  seedTicket(s, { title: 'Dark mode for the whole app', body: 'The feedback pages follow my system setting. The rest of the app does not.', area: 'Dashboard', kind: 'feature', severity: 'low', by: SAM, daysAgo: 15 }, [
    { to: 'wont_do', by: ALEX, hoursLater: 26, note: 'Not this quarter. We will look at it again after the billing work.' },
  ]);

  const invoice = seedTicket(s, { title: 'Invoice total is one cent off with three line items', body: 'Invoice for the March service visit: the lines add up to 412.37 and the total says 412.38. It happens on every invoice with three or more lines.', area: 'Billing', kind: 'bug', severity: 'high', by: JORDAN, daysAgo: 6, page: '/billing/invoices', device: '1440 by 900, Chrome on macOS' }, [
    { to: 'in_progress', by: AGENT, hoursLater: 18 },
    { to: 'in_review', by: AGENT, hoursLater: 44, note: 'Each line was rounded after the total was added up. Lines are rounded first now, and a test covers three, four and ten lines. Commit 4f2c9e1 on main. Live after the next deploy.' },
  ]);

  const emails = seedTicket(s, { title: 'Reminder emails go out twice on Mondays', body: 'Two customers wrote to say they got the same reminder twice this morning.', area: 'Something else', kind: 'bug', severity: 'high', by: JORDAN, daysAgo: 9 }, [
    { to: 'in_progress', by: AGENT, hoursLater: 5 },
    { to: 'in_review', by: AGENT, hoursLater: 150, note: 'The Monday run and the daily run both picked up the same jobs. The daily run now skips Mondays. Commit 81ab3d0.' },
  ], [{ by: SAM, hoursLater: 60, body: 'It also happened on the Monday before. Checked the send log.' }]);

  seedTicket(s, { title: 'The dashboard chart has no labels for the weeks', body: 'The bars are there but nothing says which week is which.', area: 'Dashboard', kind: 'change', severity: 'medium', by: ALEX, daysAgo: 4 }, [{ to: 'in_progress', by: SAM, hoursLater: 20 }]);

  seedTicket(s, { title: 'Export the jobs list as a spreadsheet', body: 'For the monthly review I copy the jobs list by hand. A button that gives me the same list as a CSV file would save an hour.', area: 'Jobs', kind: 'feature', severity: 'medium', by: SAM, daysAgo: 8 }, [{ to: 'in_progress', by: AGENT, hoursLater: 170 }], [
    { by: AGENT, hoursLater: 171, body: 'Started on this. The export will take the filters that are on screen, so it matches what you see.' },
  ]);

  const past = seedTicket(s, { title: 'Booking form accepts a job date in the past', body: 'I booked a job for yesterday by mistake and it went straight to the technician.', area: 'Jobs', kind: 'bug', severity: 'critical', by: JORDAN, daysAgo: 1, page: '/jobs/new', device: '390 by 844, Safari on iOS' });
  const photo = seedTicket(s, { title: "Show the technician's photo on the job card", body: 'Customers ask who is coming. A photo on the card would answer it before they call.', area: 'Jobs', kind: 'feature', severity: 'low', by: JORDAN, daysAgo: 3 });
  const accent = seedTicket(s, { title: 'Customer search misses names with an accent', body: 'Searching for Jose does not find José.', area: 'Customers', kind: 'bug', severity: 'medium', by: SAM, daysAgo: 2 });

  // What the bells say: the approver hears of the new tickets, the client hears that two of theirs wait for a test.
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  for (const t of [past, photo, accent]) s.notices.push({ ticketId: t.id, member: ALEX, reason: 'filed', actor: t.filedBy, toStatus: null, note: null, at: t.filedAt, readAt: null });
  s.notices.push({ ticketId: invoice.id, member: JORDAN, reason: 'moved', actor: AGENT, toStatus: 'in_review', note: 'Each line was rounded after the total was added up.', at: invoice.statusAt ?? at(4), readAt: null });
  s.notices.push({ ticketId: emails.id, member: JORDAN, reason: 'moved', actor: AGENT, toStatus: 'in_review', note: 'The daily run now skips Mondays.', at: emails.statusAt ?? at(2), readAt: null });
  s.notices.push({ ticketId: reset.id, member: JORDAN, reason: 'moved', actor: ALEX, toStatus: 'done', note: 'Tested on two iPhones and an Android phone. Works.', at: reset.statusAt ?? at(10), readAt: at(9) });
  return s;
}
