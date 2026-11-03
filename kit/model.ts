// What a ticket is, its words, and the rules every screen, adapter and test shares. No imports, so it runs anywhere:
// in the browser, in Node, in a test. The database enforces the same rules (supabase/migrations); when you change a
// rule here, change it there too, and the other way round.

export type FeedbackKind = 'bug' | 'change' | 'feature';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'new' | 'in_progress' | 'in_review' | 'done' | 'wont_do';
export type FeedbackRole = 'approver' | 'member' | 'agent';
export type FeedbackTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger';

/** Someone on the feedback list. An approver also changes any ticket and manages the list. An agent never closes one. */
export interface FeedbackUser {
  email: string;
  name: string;
  role: FeedbackRole;
}

export interface Ticket {
  id: string;
  number: number;
  title: string;
  body: string;
  area: string;
  kind: FeedbackKind;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  /** The page it was filed from (a path only, never a query string), when the floating button filed it. */
  page: string | null;
  /** The screen size and browser it was filed from, when the floating button filed it. */
  device: string | null;
  filedBy: string;
  filedAt: string;
  updatedAt: string;
  statusBy: string | null;
  statusAt: string | null;
  /** Whoever last moved it to In review. They do not mark it Done themselves. */
  reviewBy: string | null;
}

export interface TicketComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface TicketFile {
  id: string;
  name: string;
  path: string;
  bytes: number;
  mime: string;
  addedBy: string;
  addedAt: string;
}

export interface TicketEvent {
  id: number;
  actor: string;
  what: string;
  at: string;
}

export interface TicketFull {
  ticket: Ticket;
  comments: TicketComment[];
  files: TicketFile[];
  events: TicketEvent[];
}

/** What you type to file a ticket, or to change one. */
export interface TicketDraft {
  title: string;
  body: string;
  area: string;
  kind: FeedbackKind;
  severity: FeedbackSeverity;
  page?: string | null;
  device?: string | null;
}

/** A line on someone's bell. One a ticket and a person: something new about the same ticket replaces it. */
export interface FeedbackNotice {
  ticketId: string;
  number: number;
  title: string;
  reason: 'filed' | 'moved' | 'comment';
  actor: string;
  toStatus: FeedbackStatus | null;
  note: string | null;
  at: string;
  read: boolean;
}

export interface Option<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export const KINDS: Option<FeedbackKind>[] = [
  { value: 'bug', label: 'Bug', hint: 'Something is broken or does the wrong thing.' },
  { value: 'change', label: 'Change', hint: 'Something that works should work or read differently.' },
  { value: 'feature', label: 'New feature', hint: 'Something the app does not do yet.' },
];

export const SEVERITIES: Option<FeedbackSeverity>[] = [
  { value: 'low', label: 'Low', hint: 'A small thing. It can wait.' },
  { value: 'medium', label: 'Medium', hint: 'It gets in the way, and there is a way around it.' },
  { value: 'high', label: 'High', hint: 'It stops real work, or gets something wrong.' },
  { value: 'critical', label: 'Critical', hint: 'Something goes out wrong, data is lost, or nobody can work.' },
];

/** The board's columns, in the order a ticket moves. */
export const STATUSES: Array<Option<FeedbackStatus> & { tone: FeedbackTone }> = [
  { value: 'new', label: 'New', hint: 'Filed. Nobody has started on it.', tone: 'info' },
  { value: 'in_progress', label: 'In progress', hint: 'Someone is working on it.', tone: 'accent' },
  { value: 'in_review', label: 'In review', hint: 'The fix is made. Someone else tests it again, then marks it Done.', tone: 'warning' },
  { value: 'done', label: 'Done', hint: 'Tested again by a person, and it works.', tone: 'success' },
  { value: 'wont_do', label: "Won't do", hint: 'Turned down, with a reason in the comments.', tone: 'neutral' },
];

export const ROLES: Option<FeedbackRole>[] = [
  { value: 'approver', label: 'Approver', hint: 'Files, moves and closes tickets, changes any ticket, and manages this list.' },
  { value: 'member', label: 'Member', hint: 'Files, moves, comments and closes tickets. Changes only their own.' },
  { value: 'agent', label: 'Agent', hint: 'An AI agent. Reads, comments and moves a ticket to In review. Never closes one.' },
];

export const SEVERITY_TONE: Record<FeedbackSeverity, FeedbackTone> = { low: 'neutral', medium: 'info', high: 'warning', critical: 'danger' };
export const KIND_TONE: Record<FeedbackKind, FeedbackTone> = { bug: 'danger', change: 'accent', feature: 'success' };

/** Used when you do not pass the parts of your app. Pass your menu's items instead (see INSTALL.md). */
export const DEFAULT_AREAS = ['Something else'];

export const statusOf = (value: FeedbackStatus) => STATUSES.find((s) => s.value === value) ?? STATUSES[0];
export const kindOf = (value: FeedbackKind) => KINDS.find((k) => k.value === value) ?? KINDS[0];
export const severityOf = (value: FeedbackSeverity) => SEVERITIES.find((s) => s.value === value) ?? SEVERITIES[1];
export const roleOf = (value: FeedbackRole) => ROLES.find((r) => r.value === value) ?? ROLES[1];
export const isOpen = (status: FeedbackStatus) => status === 'new' || status === 'in_progress' || status === 'in_review';

// ---------- the rules of who may do what. The database says the same sentences.

export const LIMITS = { title: 200, body: 10000, area: 60, comment: 5000 } as const;

export const SAYS = {
  agentCloses: "Only a person marks a ticket Done or Won't do, after testing it again. Move it to In review.",
  reviewFirst: 'A ticket is tested in In review before it is Done. Move it to In review first.',
  selfReview: 'You moved this ticket to In review, so someone else tests it and marks it Done.',
  notYours: 'Only whoever filed a ticket, or an approver, changes what it says. Leave a comment instead.',
  noTitle: 'The ticket needs a title.',
  notOnList: 'You are not on the feedback list for this app.',
  onlyApprover: 'Only an approver changes the feedback list.',
  lastApprover: 'The list needs at least one approver.',
} as const;

/** Why this person may not move this ticket there, or null when they may. Won't do may come from any status. */
export function whyNotMove(user: FeedbackUser, ticket: Pick<Ticket, 'status' | 'reviewBy'>, to: FeedbackStatus): string | null {
  if (user.role === 'agent' && (to === 'done' || to === 'wont_do')) return SAYS.agentCloses;
  if (to === 'done' && ticket.status !== 'done') {
    if (ticket.status !== 'in_review') return SAYS.reviewFirst;
    if (ticket.reviewBy === user.email) return SAYS.selfReview;
  }
  return null;
}

/**
 * The page a ticket was filed from, as the database keeps it: a path in the app, or nothing. A query string or a part
 * after # is cut off (sign-in links carry tokens there), and anything that is not a plain path is dropped, because an
 * agent reads it.
 */
export function cleanPage(page: string | null | undefined): string | null {
  const path = (page ?? '').split(/[?#]/)[0].trim().slice(0, 300);
  return /^\/([^/\s?#][^\s?#]*)?$/.test(path) ? path : null;
}

/** Whether this person may change what a ticket says: whoever filed it, or an approver. */
export const mayEdit = (ticket: Pick<Ticket, 'filedBy'>, user: FeedbackUser) => user.role === 'approver' || ticket.filedBy === user.email;

// ---------- the order and the filters of a list

const SEVERITY_RANK: Record<FeedbackSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Open tickets first, the most severe first and then the oldest: the work queue. Closed ones, the latest closed first. */
export function queueOrder(a: Ticket, b: Ticket): number {
  const openA = isOpen(a.status);
  const openB = isOpen(b.status);
  if (openA !== openB) return openA ? -1 : 1;
  if (!openA) return (b.statusAt ?? b.updatedAt).localeCompare(a.statusAt ?? a.updatedAt);
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.filedAt.localeCompare(b.filedAt);
}

export type StatusFilter = 'open' | 'closed' | 'all';

export interface TicketFilters {
  status: StatusFilter;
  kind: FeedbackKind | 'all';
  severity: FeedbackSeverity | 'all';
  area: string;
  search: string;
}

export const NO_FILTERS: TicketFilters = { status: 'open', kind: 'all', severity: 'all', area: 'all', search: '' };

export function filterTickets(tickets: Ticket[], f: TicketFilters): Ticket[] {
  const words = f.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tickets
    .filter((t) => {
      if (f.status === 'open' && !isOpen(t.status)) return false;
      if (f.status === 'closed' && isOpen(t.status)) return false;
      if (f.kind !== 'all' && t.kind !== f.kind) return false;
      if (f.severity !== 'all' && t.severity !== f.severity) return false;
      if (f.area !== 'all' && t.area !== f.area) return false;
      if (words.length > 0) {
        const hay = `${t.number} ${t.title} ${t.body} ${t.area}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    })
    .sort(queueOrder);
}

export function statsOf(tickets: Ticket[]) {
  return {
    open: tickets.filter((t) => isOpen(t.status)).length,
    new: tickets.filter((t) => t.status === 'new').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    inReview: tickets.filter((t) => t.status === 'in_review').length,
    urgent: tickets.filter((t) => isOpen(t.status) && (t.severity === 'high' || t.severity === 'critical')).length,
    done: tickets.filter((t) => t.status === 'done').length,
  };
}

// ---------- files. The storage bucket says the same, so a file is refused before an upload is tried.

export const FILE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 8;

/** Why a file cannot go on a ticket, or null when it can. */
export function fileProblem(file: { name: string; type: string; size: number }): string | null {
  if (!FILE_TYPES.includes(file.type)) return `${file.name} is not a picture, a PDF or a video, so it cannot be added.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is over 50 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** A file's name made safe for a storage path: no folders, plain letters, never empty. */
export function safeFileName(name: string): string {
  const base = (name || 'file').split(/[/\\]/).pop() || 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '');
  return cleaned.slice(0, 120) || 'file';
}

/** Where a file is kept: the ticket's own folder, which the database checks. */
export const filePath = (ticketId: string, name: string, random: string) => `${ticketId}/${random}-${safeFileName(name)}`;

export const megabytes = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

// ---------- words

/** What a line on the bell says: "Alex moved it to In review". */
export function noticeSays(n: FeedbackNotice, nameOf: (email: string) => string): string {
  const who = nameOf(n.actor);
  if (n.reason === 'filed') return `${who} filed a ticket`;
  if (n.reason === 'moved' && n.toStatus) return `${who} moved it to ${statusOf(n.toStatus).label}`;
  return `${who} commented`;
}

/** A name from an address, for anyone not on the list any more. */
export function nameFromEmail(email: string | null): string {
  if (!email) return 'Someone';
  const first = email.split('@')[0].split(/[._+-]/)[0] || email;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** "3 minutes ago", "2 days ago". */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const units: Array<[number, string]> = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

/** "Nov 3, 9:41 AM", in the reader's own time zone. */
export const when = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** The screen size and browser, for a ticket filed from the floating button. Nothing that identifies a person. */
export function describeDevice(w: number, h: number, userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'another browser';
  const system = /iPhone|iPad/.test(userAgent) ? 'iOS' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : '';
  return `${w} by ${h}, ${browser}${system ? ` on ${system}` : ''}`;
}
