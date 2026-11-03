// The migration on a real Postgres: the contract through the SQL functions, then what no screen would try,
// straight at the tables and the bucket, and finally the way back.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runContract } from './contract';
import { asPerson, freshDatabase, sqlApi, UNDO, type Person } from './pglite';

const CAST: Person[] = [
  { key: 'approver', email: 'alex@example.com', name: 'Alex', role: 'approver' },
  { key: 'member', email: 'Jordan@Example.com', name: 'Jordan', role: 'member' },
  { key: 'other', email: 'sam@example.com', name: 'Sam', role: 'member' },
  { key: 'agent', email: 'agent@example.com', name: 'Claude (agent)', role: 'agent' },
  { key: 'stranger', email: 'nobody@example.com', name: 'Nobody', role: null },
  { key: 'unconfirmed', email: 'pending@example.com', name: 'Pending', role: 'member', confirmed: false },
];

describe('the database', () => {
  it('keeps the contract', async () => {
    const { db, ids } = await freshDatabase(CAST);
    const passed = await runContract({
      approver: sqlApi(db, ids.approver),
      member: sqlApi(db, ids.member),
      other: sqlApi(db, ids.other),
      agent: sqlApi(db, ids.agent),
      stranger: sqlApi(db, ids.stranger),
      emails: { approver: 'alex@example.com', member: 'jordan@example.com', other: 'sam@example.com', agent: 'agent@example.com' },
    });
    expect(passed.length).toBeGreaterThanOrEqual(14);
  });

  it('refuses everything that goes around the functions', async () => {
    const { db, ids } = await freshDatabase(CAST);
    const jordan = sqlApi(db, ids.member);
    const { ticket } = await jordan.fileTicket({ title: 'A ticket to poke at', body: '', area: 'Something else', kind: 'bug', severity: 'low' }, []);

    // Nobody writes a table directly, not even someone on the list.
    for (const sql of [
      `insert into public.feedback_tickets (title, filed_by) values ('sneaky', 'jordan@example.com')`,
      `update public.feedback_tickets set status = 'done' where id = '${ticket.id}'`,
      `delete from public.feedback_tickets where id = '${ticket.id}'`,
      `insert into public.feedback_members (email, role) values ('jordan@example.com', 'approver')`,
      `update public.feedback_members set role = 'approver' where email = 'jordan@example.com'`,
      `insert into public.feedback_comments (ticket_id, author, body) values ('${ticket.id}', 'alex@example.com', 'forged')`,
      `insert into public.feedback_events (ticket_id, actor, what) values ('${ticket.id}', 'alex@example.com', 'forged')`,
      `update public.feedback_notices set read_at = now() where true`,
    ]) {
      await expect(asPerson(db, ids.member, (tx) => tx.query(sql)), sql).rejects.toThrow(/permission denied/);
    }

    // Someone signed out reads nothing and calls nothing.
    await expect(asPerson(db, null, (tx) => tx.query('select * from public.feedback_tickets'), 'anon')).rejects.toThrow(/permission denied/);
    await expect(asPerson(db, null, (tx) => tx.query(`select public.feedback_file('{"title":"x"}'::jsonb)`), 'anon')).rejects.toThrow(/permission denied/);

    // Signed in but not on the list, or on the list with an address never confirmed: nothing is visible.
    for (const key of ['stranger', 'unconfirmed']) {
      const seen = await asPerson(db, ids[key], (tx) => tx.query('select count(*)::int as n from public.feedback_tickets'));
      expect((seen.rows[0] as { n: number }).n, key).toBe(0);
      await expect(asPerson(db, ids[key], (tx) => tx.query(`select public.feedback_file('{"title":"x"}'::jsonb)`)), key).rejects.toThrow(/not on the feedback list/);
    }

    // A call with no signed-in person at all, as a server with a stray key would make, is refused too.
    await expect(asPerson(db, null, (tx) => tx.query(`select public.feedback_file('{"title":"x"}'::jsonb)`))).rejects.toThrow(/not on the feedback list/);

    // Each person reads only their own bell.
    const bells = await asPerson(db, ids.member, (tx) => tx.query<{ member: string }>('select member from public.feedback_notices'));
    expect(bells.rows.every((r) => r.member === 'jordan@example.com')).toBe(true);
    const alexLines = await asPerson(db, ids.approver, (tx) => tx.query('select * from public.feedback_notices'));
    expect(alexLines.rows.length).toBe(1);
  });

  it('keeps files to a ticket of their own', async () => {
    const { db, ids } = await freshDatabase(CAST);
    const { ticket } = await sqlApi(db, ids.member).fileTicket({ title: 'Files', body: '', area: 'Something else', kind: 'bug', severity: 'low' }, []);
    const put = (who: string, path: string) =>
      asPerson(db, ids[who], (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner_id, metadata) values ('feedback-files', $1, auth.uid()::text, '{"size": 1234, "mimetype": "image/png"}')`, [path]));

    await expect(put('member', `${crypto.randomUUID()}/x-shot.png`), 'a folder that is not a ticket').rejects.toThrow(/row-level security/);
    await expect(put('member', 'shot.png'), 'no folder at all').rejects.toThrow(/row-level security/);
    await expect(put('stranger', `${ticket.id}/x-shot.png`), 'someone not on the list').rejects.toThrow(/row-level security/);
    await put('member', `${ticket.id}/a1-shot.png`);
    await put('other', `${ticket.id}/b2-theirs.png`);

    const add = (path: string, id = ticket.id) => asPerson(db, ids.member, (tx) => tx.query('select public.feedback_add_file($1, $2, $3)', [id, 'shot.png', path]));
    await expect(add(`${ticket.id}/never-stored.png`), 'a file that was never stored').rejects.toThrow(/not stored for this ticket/);
    await expect(add(`${ticket.id}/b2-theirs.png`), 'a file someone else uploaded').rejects.toThrow(/not stored for this ticket/);
    const other = (await sqlApi(db, ids.other).fileTicket({ title: 'Another', body: '', area: 'Something else', kind: 'bug', severity: 'low' }, [])).ticket;
    await expect(add(`${ticket.id}/a1-shot.png`, other.id), "another ticket's file").rejects.toThrow(/not stored for this ticket/);
    await add(`${ticket.id}/a1-shot.png`);

    // The size and type come from storage, not from whoever adds the file.
    const kept = await asPerson(db, ids.member, (tx) => tx.query<{ size_bytes: string; mime: string }>('select size_bytes, mime from public.feedback_files where path = $1', [`${ticket.id}/a1-shot.png`]));
    expect(kept.rows[0]).toEqual({ size_bytes: 1234, mime: 'image/png' });

    const strangerSees = await asPerson(db, ids.stranger, (tx) => tx.query(`select * from storage.objects where bucket_id = 'feedback-files'`));
    expect(strangerSees.rows.length).toBe(0);
  });

  it('comes out again with undo.sql, leaving nothing behind', async () => {
    const { db } = await freshDatabase(CAST);
    await db.exec(readFileSync(UNDO, 'utf8'));
    const left = await db.query<{ name: string }>(`
      select tablename as name from pg_tables where schemaname = 'public' and tablename like 'feedback%'
      union all select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'feedback%'
      union all select policyname from pg_policies where policyname like 'feedback%'`);
    expect(left.rows.map((r) => r.name)).toEqual([]);
  });
});
