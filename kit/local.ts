// The kit with no backend: everything is kept in this browser (localStorage), and files only until the page reloads.
// For the demo and for trying the screens out. It keeps the same rules as the database, with the same sentences, so
// what you see here is what your team sees once the real backend is in. It is not shared between people or browsers.
import type { FeedbackApi } from './api';
import {
  cleanPage,
  fileProblem,
  isOpen,
  KINDS,
  LIMITS,
  MAX_FILES,
  mayEdit,
  SAYS,
  SEVERITIES,
  STATUSES,
  statusOf,
  whyNotMove,
  type FeedbackNotice,
  type FeedbackRole,
  type FeedbackStatus,
  type FeedbackUser,
  type Ticket,
  type TicketComment,
  type TicketDraft,
  type TicketEvent,
  type TicketFile,
} from './model';

interface StoredNotice {
  ticketId: string;
  member: string;
  reason: FeedbackNotice['reason'];
  actor: string;
  toStatus: FeedbackStatus | null;
  note: string | null;
  at: string;
  readAt: string | null;
}

export interface LocalState {
  version: 1;
  members: FeedbackUser[];
  tickets: Ticket[];
  comments: Array<TicketComment & { ticketId: string }>;
  files: Array<TicketFile & { ticketId: string }>;
  events: Array<TicketEvent & { ticketId: string }>;
  notices: StoredNotice[];
  nextNumber: number;
  nextEvent: number;
}

export interface LocalOptions {
  /** The address of whoever is signed in. A function, so a demo can switch between people. */
  currentEmail: () => string;
  /** What the store starts with when this browser has nothing yet. */
  initial: () => LocalState;
  /** Where it is kept. Defaults to localStorage under "feedback-kit". Pass null to keep it in memory only. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  storageKey?: string;
}

export const emptyState = (members: FeedbackUser[]): LocalState => ({
  version: 1,
  members,
  tickets: [],
  comments: [],
  files: [],
  events: [],
  notices: [],
  nextNumber: 1,
  nextEvent: 1,
});

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

export function createLocalApi(options: LocalOptions): FeedbackApi & { reset(): void; state(): LocalState } {
  const key = options.storageKey ?? 'feedback-kit';
  const storage = options.storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : options.storage;
  // Read from the store every time, so two tabs, or two people in one test, see the same tickets. When the store is
  // missing or refuses (a private window), everything is kept in this page's memory until it reloads.
  let broken = storage === null;
  let memory: LocalState | null = null;
  // Files themselves live only in this page's memory: a browser cannot keep videos in localStorage.
  const blobs = new Map<string, Blob>();

  const save = (state: LocalState) => {
    memory = state;
    if (broken || !storage) return;
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      broken = true;
    }
  };
  const load = (): LocalState => {
    if (!broken && storage) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as LocalState;
          if (parsed?.version === 1) return parsed;
        }
      } catch {
        broken = true;
      }
    }
    if (memory) return memory;
    const fresh = options.initial();
    save(fresh);
    return fresh;
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const me = (state: LocalState): FeedbackUser => {
    const email = options.currentEmail().toLowerCase();
    const found = state.members.find((m) => m.email === email);
    if (!found) throw new Error(SAYS.notOnList);
    return found;
  };
  const ticketById = (state: LocalState, id: string) => {
    const t = state.tickets.find((x) => x.id === id);
    if (!t) throw new Error('That ticket is not there.');
    return t;
  };
  const event = (state: LocalState, ticketId: string, actor: string, what: string) => {
    state.events.push({ id: state.nextEvent++, ticketId, actor, what, at: new Date().toISOString() });
  };
  const notify = (state: LocalState, n: Omit<StoredNotice, 'readAt' | 'at'>) => {
    const at = new Date().toISOString();
    const i = state.notices.findIndex((x) => x.ticketId === n.ticketId && x.member === n.member);
    const row = { ...n, at, readAt: null };
    if (i >= 0) state.notices[i] = row;
    else state.notices.push(row);
  };

  const check = (draft: Partial<TicketDraft>, current?: Ticket) => {
    const title = (draft.title ?? current?.title ?? '').trim();
    const body = (draft.body ?? current?.body ?? '').trim();
    const area = (draft.area ?? current?.area ?? '').trim() || 'Something else';
    const kind = draft.kind ?? current?.kind ?? 'bug';
    const severity = draft.severity ?? current?.severity ?? 'medium';
    if (!title) throw new Error(SAYS.noTitle);
    if (title.length > LIMITS.title) throw new Error('A title is 200 characters at most.');
    if (body.length > LIMITS.body) throw new Error('What happened is 10,000 characters at most.');
    if (area.length > LIMITS.area) throw new Error('The part of the app is 60 characters at most.');
    if (!KINDS.some((k) => k.value === kind)) throw new Error('A ticket is a bug, a change or a new feature.');
    if (!SEVERITIES.some((s) => s.value === severity)) throw new Error('Severity is low, medium, high or critical.');
    return { title, body, area, kind, severity };
  };

  const api: FeedbackApi & { reset(): void; state(): LocalState } = {
    reset() {
      blobs.clear();
      save(options.initial());
    },
    state: () => load(),

    async whoami() {
      await settle();
      const state = load();
      return state.members.find((m) => m.email === options.currentEmail().toLowerCase()) ?? null;
    },

    async people() {
      await settle();
      return [...load().members].sort((a, b) => a.name.localeCompare(b.name));
    },

    async listTickets() {
      await settle();
      const state = load();
      me(state);
      return [...state.tickets].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
    },

    async getTicket(id) {
      await settle();
      const state = load();
      me(state);
      const ticket = ticketById(state, id);
      const strip = <T extends { ticketId: string }>({ ticketId: _drop, ...rest }: T) => rest;
      return {
        ticket,
        comments: state.comments.filter((c) => c.ticketId === id).map(strip),
        files: state.files.filter((f) => f.ticketId === id).map(strip),
        events: state.events.filter((e) => e.ticketId === id).map(strip),
      };
    },

    async fileTicket(draft, files) {
      await settle();
      const state = load();
      const user = me(state);
      const clean = check(draft);
      const now = new Date().toISOString();
      const ticket: Ticket = {
        id: uid(),
        number: state.nextNumber++,
        ...clean,
        status: 'new',
        page: cleanPage(draft.page),
        device: draft.device?.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 120) || null,
        filedBy: user.email,
        filedAt: now,
        updatedAt: now,
        statusBy: null,
        statusAt: null,
        reviewBy: null,
      };
      state.tickets.push(ticket);
      event(state, ticket.id, user.email, 'filed it');
      for (const m of state.members) {
        if (m.role === 'approver' && m.email !== user.email) notify(state, { ticketId: ticket.id, member: m.email, reason: 'filed', actor: user.email, toStatus: null, note: null });
      }
      save(state);
      const problems = files.length > 0 ? await api.addFiles(ticket.id, files) : [];
      return { ticket: ticketById(load(), ticket.id), problems };
    },

    async addFiles(ticketId, files) {
      await settle();
      const state = load();
      const user = me(state);
      ticketById(state, ticketId);
      const problems: string[] = [];
      files.forEach((file, i) => {
        if (i >= MAX_FILES) {
          problems.push(`Only ${MAX_FILES} files go on at a time, so ${file.name} was left off.`);
          return;
        }
        const why = fileProblem(file);
        if (why) {
          problems.push(why);
          return;
        }
        const id = uid();
        blobs.set(id, file);
        state.files.push({ id, ticketId, name: file.name.slice(0, 200), path: `${ticketId}/${id}`, bytes: file.size, mime: file.type, addedBy: user.email, addedAt: new Date().toISOString() });
        event(state, ticketId, user.email, `added a file, ${file.name.slice(0, 200)}`);
      });
      const t = ticketById(state, ticketId);
      t.updatedAt = new Date().toISOString();
      save(state);
      return problems;
    },

    async editTicket(id, patch) {
      await settle();
      const state = load();
      const user = me(state);
      const t = ticketById(state, id);
      if (!mayEdit(t, user)) throw new Error(SAYS.notYours);
      const next = check(patch, t);
      const changed: string[] = [];
      if (next.title !== t.title) changed.push('the title');
      if (next.body !== t.body) changed.push('what happened');
      if (next.area !== t.area) changed.push(`the part of the app to ${next.area}`);
      if (next.kind !== t.kind) changed.push(`the kind to ${KINDS.find((k) => k.value === next.kind)?.label.toLowerCase()}`);
      if (next.severity !== t.severity) changed.push(`the severity from ${t.severity} to ${next.severity}`);
      if (changed.length === 0) return t;
      Object.assign(t, next, { updatedAt: new Date().toISOString() });
      event(state, id, user.email, `changed ${changed.join(', ')}`);
      save(state);
      return t;
    },

    async moveTicket(id, status, note = '') {
      await settle();
      const state = load();
      const user = me(state);
      const t = ticketById(state, id);
      if (!STATUSES.some((s) => s.value === status)) throw new Error("A ticket is New, In progress, In review, Done or Won't do.");
      const why = whyNotMove(user, t, status);
      if (why) throw new Error(why);
      const text = note.trim();
      if (text.length > LIMITS.comment) throw new Error('A comment is 5,000 characters at most.');
      if (t.status === status && !text) return t;
      const from = t.status;
      const now = new Date().toISOString();
      if (from !== status) {
        Object.assign(t, { status, statusBy: user.email, statusAt: now, updatedAt: now });
        if (status === 'in_review') t.reviewBy = user.email;
        event(state, id, user.email, `moved it from ${statusOf(from).label} to ${statusOf(status).label}`);
      }
      if (text) state.comments.push({ id: uid(), ticketId: id, author: user.email, body: text, at: now });
      if (t.filedBy !== user.email) {
        notify(state, { ticketId: id, member: t.filedBy, reason: from !== status ? 'moved' : 'comment', actor: user.email, toStatus: from !== status ? status : null, note: text ? text.slice(0, 300) : null });
      }
      save(state);
      return t;
    },

    async addComment(id, body) {
      await settle();
      const state = load();
      const user = me(state);
      const t = ticketById(state, id);
      const text = body.trim();
      if (!text) throw new Error('The comment is empty.');
      if (text.length > LIMITS.comment) throw new Error('A comment is 5,000 characters at most.');
      state.comments.push({ id: uid(), ticketId: id, author: user.email, body: text, at: new Date().toISOString() });
      t.updatedAt = new Date().toISOString();
      if (t.filedBy !== user.email) notify(state, { ticketId: id, member: t.filedBy, reason: 'comment', actor: user.email, toStatus: null, note: text.slice(0, 300) });
      save(state);
    },

    async fileLink(file) {
      await settle();
      const blob = blobs.get(file.id);
      if (!blob) throw new Error('This demo keeps files only until the page reloads, so this one is gone. With a real backend it stays.');
      return URL.createObjectURL(blob);
    },

    async notices() {
      await settle();
      const state = load();
      const user = me(state);
      return state.notices
        .filter((n) => n.member === user.email)
        .map((n) => {
          const t = state.tickets.find((x) => x.id === n.ticketId);
          return { ticketId: n.ticketId, number: t?.number ?? 0, title: t?.title ?? '', reason: n.reason, actor: n.actor, toStatus: n.toStatus, note: n.note, at: n.at, read: n.readAt !== null };
        })
        .sort((a, b) => b.at.localeCompare(a.at));
    },

    async markRead(ticketId) {
      await settle();
      const state = load();
      const user = me(state);
      for (const n of state.notices) if (n.ticketId === ticketId && n.member === user.email && !n.readAt) n.readAt = new Date().toISOString();
      save(state);
    },

    async markAllRead() {
      await settle();
      const state = load();
      const user = me(state);
      for (const n of state.notices) if (n.member === user.email && !n.readAt) n.readAt = new Date().toISOString();
      save(state);
    },

    async addPerson(person) {
      await settle();
      const state = load();
      const user = me(state);
      if (user.role !== 'approver') throw new Error(SAYS.onlyApprover);
      const email = person.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That is not an email address.');
      const role: FeedbackRole = person.role;
      const existing = state.members.find((m) => m.email === email);
      if (existing && existing.role === 'approver' && role !== 'approver' && state.members.filter((m) => m.role === 'approver').length === 1) throw new Error(SAYS.lastApprover);
      if (existing) Object.assign(existing, { name: person.name.trim() || existing.name, role });
      else state.members.push({ email, name: person.name.trim() || email.split('@')[0], role });
      save(state);
    },

    async removePerson(email) {
      await settle();
      const state = load();
      const user = me(state);
      if (user.role !== 'approver') throw new Error(SAYS.onlyApprover);
      const target = state.members.find((m) => m.email === email.toLowerCase());
      if (!target) return;
      if (target.role === 'approver' && state.members.filter((m) => m.role === 'approver').length === 1) throw new Error(SAYS.lastApprover);
      state.members = state.members.filter((m) => m.email !== target.email);
      save(state);
    },
  };
  return api;
}

/** For the demo's seed: a ticket that has already moved, with its history. */
export function seedTicket(state: LocalState, t: { title: string; body: string; area: string; kind: Ticket['kind']; severity: Ticket['severity']; by: string; daysAgo: number; page?: string; device?: string }, moves: Array<{ to: FeedbackStatus; by: string; hoursLater: number; note?: string }> = [], comments: Array<{ by: string; hoursLater: number; body: string }> = []) {
  const base = Date.now() - t.daysAgo * 86_400_000;
  const at = (hours: number) => new Date(base + hours * 3_600_000).toISOString();
  const ticket: Ticket = {
    id: uid(),
    number: state.nextNumber++,
    title: t.title,
    body: t.body,
    area: t.area,
    kind: t.kind,
    severity: t.severity,
    status: 'new',
    page: t.page ?? null,
    device: t.device ?? null,
    filedBy: t.by,
    filedAt: at(0),
    updatedAt: at(0),
    statusBy: null,
    statusAt: null,
    reviewBy: null,
  };
  state.tickets.push(ticket);
  state.events.push({ id: state.nextEvent++, ticketId: ticket.id, actor: t.by, what: 'filed it', at: at(0) });
  const timeline = [...moves.map((m) => ({ kind: 'move' as const, ...m })), ...comments.map((c) => ({ kind: 'comment' as const, to: null, note: undefined, ...c }))].sort((a, b) => a.hoursLater - b.hoursLater);
  for (const step of timeline) {
    const when = at(step.hoursLater);
    if (step.kind === 'move' && step.to) {
      state.events.push({ id: state.nextEvent++, ticketId: ticket.id, actor: step.by, what: `moved it from ${statusOf(ticket.status).label} to ${statusOf(step.to).label}`, at: when });
      Object.assign(ticket, { status: step.to, statusBy: step.by, statusAt: when, updatedAt: when });
      if (step.to === 'in_review') ticket.reviewBy = step.by;
      if (step.note) state.comments.push({ id: uid(), ticketId: ticket.id, author: step.by, body: step.note, at: when });
    } else if (step.kind === 'comment') {
      state.comments.push({ id: uid(), ticketId: ticket.id, author: step.by, body: step.body, at: when });
      ticket.updatedAt = when;
    }
  }
  return ticket;
}

export const openCount = (state: LocalState) => state.tickets.filter((t) => isOpen(t.status)).length;
