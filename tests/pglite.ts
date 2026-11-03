// A real Postgres in this process (PGlite), with the few parts of Supabase the migration leans on: auth.users and
// auth.uid(), the storage tables, the roles anon and authenticated, and Supabase's habit of granting every new table
// and function to those roles (so the migration's own revokes are tested too). Then the migration itself, unchanged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { FeedbackApi } from '../kit/api';
import { fileProblem, filePath, MAX_FILES, type FeedbackNotice, type FeedbackUser } from '../kit/model';
import { toTicket, type TicketRow } from '../kit/supabase';

export const MIGRATION = fileURLToPath(new URL('../supabase/migrations/20261103000000_testing_feedback.sql', import.meta.url));
export const UNDO = fileURLToPath(new URL('../supabase/undo.sql', import.meta.url));

const SUPABASE_STANDIN = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid, owner_id text, metadata jsonb, unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert on storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export interface Person {
  key: string;
  email: string;
  name: string;
  role: FeedbackUser['role'] | null;
  confirmed?: boolean;
}

export async function freshDatabase(people: Person[]) {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(readFileSync(MIGRATION, 'utf8'));
  const ids: Record<string, string> = {};
  for (const p of people) {
    const id = crypto.randomUUID();
    ids[p.key] = id;
    await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)', [id, p.email, p.confirmed === false ? null : new Date().toISOString()]);
    if (p.role) await db.query('insert into public.feedback_members (email, name, role) values ($1, $2, $3)', [p.email.toLowerCase(), p.name, p.role]);
  }
  return { db, ids };
}

/** Runs fn as one signed-in person, the way Supabase runs a request: role authenticated, their id in the claims. */
export function asPerson<T>(db: PGlite, userId: string | null, fn: (tx: Transaction) => Promise<T>, role = 'authenticated'): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [userId ? JSON.stringify({ sub: userId, role }) : '']);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

// PGlite hands back timestamps as Date objects. The screens and the contract speak ISO text, as Supabase does.
function plain<T>(value: T): T {
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map(plain) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) as T;
  return value;
}

/** The FeedbackApi straight on the SQL functions, so the contract runs against the database itself. */
export function sqlApi(db: PGlite, userId: string): FeedbackApi {
  const as = <T>(fn: (tx: Transaction) => Promise<T>) => asPerson(db, userId, fn);
  const rows = async <T>(tx: Transaction, sql: string, params: unknown[] = []) => plain((await tx.query<T>(sql, params)).rows);
  const api: FeedbackApi = {
    whoami: () => as(async (tx) => ((await rows<{ r: FeedbackUser | null }>(tx, 'select public.feedback_whoami() as r'))[0]?.r ?? null)),
    people: () => as((tx) => rows<FeedbackUser>(tx, 'select email, name, role from public.feedback_members order by name')),
    listTickets: () => as(async (tx) => (await rows<TicketRow>(tx, 'select * from public.feedback_tickets order by filed_at desc')).map(toTicket)),
    getTicket: (id) =>
      as(async (tx) => {
        const [ticket] = await rows<TicketRow>(tx, 'select * from public.feedback_tickets where id = $1', [id]);
        if (!ticket) throw new Error('That ticket is not there.');
        const comments = await rows<{ id: string; author: string; body: string; at: string }>(tx, 'select id, author, body, at from public.feedback_comments where ticket_id = $1 order by at', [id]);
        const files = await rows<{ id: string; name: string; path: string; size_bytes: number; mime: string; added_by: string; added_at: string }>(tx, 'select * from public.feedback_files where ticket_id = $1 order by added_at', [id]);
        const events = await rows<{ id: number; actor: string; what: string; at: string }>(tx, 'select id, actor, what, at from public.feedback_events where ticket_id = $1 order by id', [id]);
        return {
          ticket: toTicket(ticket),
          comments,
          files: files.map((f) => ({ id: f.id, name: f.name, path: f.path, bytes: Number(f.size_bytes), mime: f.mime, addedBy: f.added_by, addedAt: f.added_at })),
          events: events.map((e) => ({ ...e, id: Number(e.id) })),
        };
      }),
    fileTicket: async (draft, files) => {
      const ticket = toTicket((await as((tx) => rows<TicketRow>(tx, 'select * from public.feedback_file($1::jsonb)', [JSON.stringify(draft)])))[0]);
      const problems = files.length ? await api.addFiles(ticket.id, files) : [];
      return { ticket, problems };
    },
    addFiles: async (ticketId, files) => {
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
        const path = filePath(ticketId, file.name, crypto.randomUUID().slice(0, 8));
        try {
          // The upload, as Supabase Storage does it: an insert into storage.objects under its rules, with the uploader
          // as owner and the real size and type in its metadata.
          await as((tx) => tx.query(`insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('feedback-files', $1, auth.uid(), auth.uid()::text, $2::jsonb)`, [path, JSON.stringify({ size: file.size, mimetype: file.type })]));
          await as((tx) => tx.query('select public.feedback_add_file($1, $2, $3)', [ticketId, file.name, path]));
        } catch (err) {
          problems.push(`${file.name} could not be added: ${(err as Error).message}`);
        }
      }
      return problems;
    },
    editTicket: async (id, patch) => toTicket((await as((tx) => rows<TicketRow>(tx, 'select * from public.feedback_edit($1, $2::jsonb)', [id, JSON.stringify(patch)])))[0]),
    moveTicket: async (id, status, note = '') => toTicket((await as((tx) => rows<TicketRow>(tx, 'select * from public.feedback_move($1, $2, $3)', [id, status, note.trim() || null])))[0]),
    addComment: async (id, body) => {
      await as((tx) => tx.query('select public.feedback_comment($1, $2)', [id, body]));
    },
    fileLink: (file) =>
      as(async (tx) => {
        const found = await rows<{ name: string }>(tx, `select name from storage.objects where bucket_id = 'feedback-files' and name = $1`, [file.path]);
        if (!found.length) throw new Error('The file could not be opened.');
        return `pglite://feedback-files/${file.path}`;
      }),
    notices: () =>
      as(async (tx) => {
        const [{ r }] = await rows<{ r: Array<{ ticket_id: string; number: number; title: string; reason: FeedbackNotice['reason']; actor: string; to_status: FeedbackNotice['toStatus']; note: string | null; at: string; read: boolean }> }>(tx, 'select public.feedback_my_notices() as r');
        return r.map((n) => ({ ticketId: n.ticket_id, number: n.number, title: n.title, reason: n.reason, actor: n.actor, toStatus: n.to_status, note: n.note, at: n.at, read: n.read }));
      }),
    markRead: async (id) => {
      await as((tx) => tx.query('select public.feedback_mark_read($1)', [id]));
    },
    markAllRead: async () => {
      await as((tx) => tx.query('select public.feedback_mark_all_read()'));
    },
    addPerson: async (p) => {
      await as((tx) => tx.query('select public.feedback_add_member($1, $2, $3)', [p.email, p.name, p.role]));
    },
    removePerson: async (email) => {
      await as((tx) => tx.query('select public.feedback_remove_member($1)', [email]));
    },
  };
  return api;
}
