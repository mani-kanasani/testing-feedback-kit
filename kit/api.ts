// The one thing the screens talk to. Two adapters come with the kit: createLocalApi (local.ts, in the browser only,
// for the demo and for trying it out) and createSupabaseApi (supabase.ts). For any other backend, write a third that
// does the same, and run tests/contract.ts against it (INSTALL.md, "Another backend").
import type { FeedbackNotice, FeedbackStatus, FeedbackUser, Ticket, TicketDraft, TicketFile, TicketFull } from './model';

export interface FeedbackApi {
  /** Who is signed in, as the feedback list knows them. Null when they are not on it. */
  whoami(): Promise<FeedbackUser | null>;
  /** Everyone on the list, for names and for the People tab. */
  people(): Promise<FeedbackUser[]>;
  listTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<TicketFull>;
  /** Files a ticket, then its files. A file that cannot be stored never loses the ticket: it comes back as a sentence. */
  fileTicket(draft: TicketDraft, files: File[]): Promise<{ ticket: Ticket; problems: string[] }>;
  /** Adds files to a ticket. Returns a sentence for each one that could not be added. */
  addFiles(ticketId: string, files: File[]): Promise<string[]>;
  editTicket(id: string, patch: Partial<TicketDraft>): Promise<Ticket>;
  /** A note goes on the ticket as a comment. */
  moveTicket(id: string, status: FeedbackStatus, note?: string): Promise<Ticket>;
  addComment(id: string, body: string): Promise<void>;
  /** A link to open a file. It may stop working after a few minutes. */
  fileLink(file: TicketFile): Promise<string>;
  /** Your own bell: newest first. */
  notices(): Promise<FeedbackNotice[]>;
  markRead(ticketId: string): Promise<void>;
  markAllRead(): Promise<void>;
  /** Approvers only. Leave these out when your app keeps its own roles, and the People tab is not shown. */
  addPerson?(person: FeedbackUser): Promise<void>;
  removePerson?(email: string): Promise<void>;
}

/** Sent on window after anything changes, so the bell and an open page read again. */
export const FEEDBACK_CHANGED = 'feedback-kit:changed';

export const announceChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEEDBACK_CHANGED));
};

export const messageOf = (err: unknown) => (err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong.');
