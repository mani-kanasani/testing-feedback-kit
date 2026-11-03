// The kit on Supabase. Pass the same client your app already signs people in with: every call runs as that person,
// and the database decides what they may do (supabase/migrations). Never pass a client made with the service role key.
import type { SupabaseClient } from '@supabase/supabase-js';
import { announceChange, type FeedbackApi } from './api';
import { fileProblem, filePath, MAX_FILES, type FeedbackNotice, type FeedbackUser, type Ticket, type TicketFull } from './model';

const BUCKET = 'feedback-files';

/** What the screens say while the migration is not in the database yet. */
export const NOT_INSTALLED = 'The feedback tables are not in this database yet. Run the migration in supabase/migrations first.';

interface PgError {
  message: string;
  code?: string;
}

function stopOn(error: PgError | null) {
  if (!error) return;
  if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code ?? '') || (/feedback/.test(error.message) && /does not exist|schema cache|could not find/i.test(error.message))) {
    throw new Error(NOT_INSTALLED);
  }
  throw new Error(error.message);
}

export interface TicketRow {
  id: string;
  number: number;
  title: string;
  body: string;
  area: string;
  kind: Ticket['kind'];
  severity: Ticket['severity'];
  status: Ticket['status'];
  page: string | null;
  device: string | null;
  filed_by: string;
  filed_at: string;
  updated_at: string;
  status_by: string | null;
  status_at: string | null;
  review_by: string | null;
}

const TICKET = 'id, number, title, body, area, kind, severity, status, page, device, filed_by, filed_at, updated_at, status_by, status_at, review_by';

export const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  number: row.number,
  title: row.title,
  body: row.body,
  area: row.area,
  kind: row.kind,
  severity: row.severity,
  status: row.status,
  page: row.page,
  device: row.device,
  filedBy: row.filed_by,
  filedAt: row.filed_at,
  updatedAt: row.updated_at,
  statusBy: row.status_by,
  statusAt: row.status_at,
  reviewBy: row.review_by,
});

const random = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10));

export function createSupabaseApi(client: SupabaseClient): FeedbackApi {
  // When someone signs in, out, or as someone else, every screen of the kit reads again.
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(announceChange, 0);
  });

  const api: FeedbackApi = {
    async whoami() {
      const { data, error } = await client.rpc('feedback_whoami');
      stopOn(error);
      return (data as FeedbackUser | null) ?? null;
    },

    async people() {
      const { data, error } = await client.from('feedback_members').select('email, name, role').order('name');
      stopOn(error);
      return (data ?? []) as FeedbackUser[];
    },

    async listTickets() {
      // Supabase hands back 1,000 rows a request at most, so the list is read a page at a time.
      const rows: TicketRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('feedback_tickets').select(TICKET).order('filed_at', { ascending: false }).order('number', { ascending: false }).range(from, from + 999);
        stopOn(error);
        rows.push(...((data ?? []) as TicketRow[]));
        if (!data || data.length < 1000) break;
      }
      return rows.map(toTicket);
    },

    async getTicket(id) {
      const [ticket, comments, files, events] = await Promise.all([
        client.from('feedback_tickets').select(TICKET).eq('id', id).maybeSingle(),
        client.from('feedback_comments').select('id, author, body, at').eq('ticket_id', id).order('at'),
        client.from('feedback_files').select('id, name, path, size_bytes, mime, added_by, added_at').eq('ticket_id', id).order('added_at'),
        client.from('feedback_events').select('id, actor, what, at').eq('ticket_id', id).order('id'),
      ]);
      stopOn(ticket.error);
      stopOn(comments.error);
      stopOn(files.error);
      stopOn(events.error);
      if (!ticket.data) throw new Error('That ticket is not there.');
      type FileRow = { id: string; name: string; path: string; size_bytes: number; mime: string; added_by: string; added_at: string };
      return {
        ticket: toTicket(ticket.data as TicketRow),
        comments: (comments.data ?? []) as TicketFull['comments'],
        files: ((files.data ?? []) as FileRow[]).map((f) => ({ id: f.id, name: f.name, path: f.path, bytes: Number(f.size_bytes), mime: f.mime, addedBy: f.added_by, addedAt: f.added_at })),
        events: (events.data ?? []) as TicketFull['events'],
      };
    },

    async fileTicket(draft, files) {
      const { data, error } = await client.rpc('feedback_file', { p: draft });
      stopOn(error);
      const ticket = toTicket(data as TicketRow);
      const problems = files.length > 0 ? await api.addFiles(ticket.id, files) : [];
      return { ticket, problems };
    },

    async addFiles(ticketId, files) {
      const problems: string[] = [];
      for (const [i, file] of files.entries()) {
        if (i >= MAX_FILES) {
          problems.push(`Only ${MAX_FILES} files go on at a time, so ${file.name} was left off.`);
          continue;
        }
        const why = fileProblem(file);
        if (why) {
          problems.push(why);
          continue;
        }
        const path = filePath(ticketId, file.name, random());
        const stored = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (stored.error) {
          problems.push(`${file.name} could not be stored: ${stored.error.message}`);
          continue;
        }
        const { error } = await client.rpc('feedback_add_file', { p_id: ticketId, p_name: file.name, p_path: path });
        if (error) problems.push(`${file.name} was stored but not added: ${error.message}`);
      }
      return problems;
    },

    async editTicket(id, patch) {
      const { data, error } = await client.rpc('feedback_edit', { p_id: id, p: patch });
      stopOn(error);
      return toTicket(data as TicketRow);
    },

    async moveTicket(id, status, note = '') {
      const { data, error } = await client.rpc('feedback_move', { p_id: id, p_status: status, p_note: note.trim() || null });
      stopOn(error);
      return toTicket(data as TicketRow);
    },

    async addComment(id, body) {
      const { error } = await client.rpc('feedback_comment', { p_id: id, p_body: body });
      stopOn(error);
    },

    async fileLink(file) {
      // Ten minutes, and it downloads under its own name rather than opening on the storage address.
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(file.path, 600, { download: file.name });
      stopOn(error);
      if (!data?.signedUrl) throw new Error('The file could not be opened.');
      return data.signedUrl;
    },

    async notices() {
      const { data, error } = await client.rpc('feedback_my_notices');
      stopOn(error);
      type Row = { ticket_id: string; number: number; title: string; reason: FeedbackNotice['reason']; actor: string; to_status: FeedbackNotice['toStatus']; note: string | null; at: string; read: boolean };
      return ((data ?? []) as Row[]).map((n) => ({ ticketId: n.ticket_id, number: n.number, title: n.title, reason: n.reason, actor: n.actor, toStatus: n.to_status, note: n.note, at: n.at, read: n.read }));
    },

    async markRead(ticketId) {
      const { error } = await client.rpc('feedback_mark_read', { p_id: ticketId });
      stopOn(error);
    },

    async markAllRead() {
      const { error } = await client.rpc('feedback_mark_all_read');
      stopOn(error);
    },

    async addPerson(person) {
      const { error } = await client.rpc('feedback_add_member', { p_email: person.email, p_name: person.name, p_role: person.role });
      stopOn(error);
    },

    async removePerson(email) {
      const { error } = await client.rpc('feedback_remove_member', { p_email: email });
      stopOn(error);
    },
  };
  return api;
}
