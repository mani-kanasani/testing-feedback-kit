# Installing the Testing and Feedback Kit

This is the procedure Claude Code follows when you paste [the prompt](PROMPT.md) into it. A person can follow it too.
It takes the kit from this repository and adds it to **your** app: a Feedback page, a floating Feedback button on
every page, a bell, the database rules behind them, and an agent that works the tickets.

**For the agent doing the install:** read this whole file before you change anything. Do the steps in order. Where a
step says to ask, ask the person with two or three choices and say which one you recommend. Where it says to stop,
stop.

## The rules while installing

- **Never print, paste or commit a secret.** Keys and passwords stay in files that git ignores. If you make a
  password, make it inside a script that writes it straight to that file.
- **The service role key never goes into browser code, and never into the agent server.** The kit runs every call as
  the signed-in person, and the database decides what they may do. A service role key skips all of that.
- **Nothing touches a production database without the person's yes in this conversation.** Run the migration on a
  local or development database first.
- **Change only what the kit needs.** Do not refactor, rename or restyle anything else in the app.
- **Keep the kit's files as they are**, apart from the places this file says to change. Keep `kit/LICENSE` with
  them: it is MIT, and the notice travels with the code.

## What is in the kit

| Path | What it is | Where it goes in the app |
|---|---|---|
| `kit/` | The screens (React), the rules (`model.ts`), the styles (`feedback.css`), and two data adapters: `supabase.ts` and `local.ts`. | One folder, for example `src/feedback/` |
| `supabase/migrations/20261103000000_testing_feedback.sql` | The database: six tables named `feedback_*`, the functions that write them, the storage bucket and its rules. | `supabase/migrations/`, with a new timestamp |
| `supabase/undo.sql` | Takes it all out again. | Keep it in the clone; nothing to copy |
| `mcp/` | The agent server: four tools for Claude Code. | `tools/feedback-mcp/` |
| `claude/skills/feedback-queue/` | How an agent works the queue. | `.claude/skills/feedback-queue/` |
| `tests/contract.ts` | The checks every backend must pass. | Stays in the clone |

## 1. Look at the app first, then say the plan

Find out, without changing anything:

1. **The framework.** React (Vite, Next.js, Remix, anything with React 18 or newer) takes the screens as they are.
   Anything else needs the screens ported (step 5, "Not React").
2. **The router.** React Router, Next.js, TanStack Router, a hash router, or none.
3. **The backend and sign-in.** Supabase with Supabase Auth is the straight path. Supabase with another sign-in
   (Clerk, Auth0), or another backend entirely, needs step 4b or 4c.
4. **Where the menu is, where the top bar is, and the layout every signed-in page shares.**
5. **The menu's items.** They become the "part of the app" a ticket is about.
6. **Whether the app has a light theme, a dark one, or both,** and where its colours are defined.

Then tell the person in a few lines what you found and what you will do, and ask:

- **Who is the first approver?** Their email address as they sign in to the app. Recommend themselves.
- **Where does the page go?** Recommend `/feedback`, with a menu item called "Testing and feedback" or "Feedback".
- **Do they want the agent part now?** Recommend yes if they use Claude Code on this project.

## 2. Copy the kit in

Clone this repository outside the app (`git clone --depth 1 https://github.com/mani-kanasani/testing-feedback-kit`)
and copy the folder `kit/` into the app, for example as `src/feedback/`. Copy it whole, `LICENSE` included.

`kit/supabase.ts` imports a type from `@supabase/supabase-js`. On another backend, leave that file out.

The kit needs React 18 or newer and nothing else. It does not use Tailwind or any component library, so it never
fights the app's own.

## 3. The styles

Import the styles once, where the app imports its global CSS:

```ts
import './feedback/feedback.css';
```

Every class starts with `fk-` and everything sits under `.fk`, so nothing leaks into the app.

**Make it look like the app.** The colours are CSS variables at the top of `feedback.css`. Do not edit that file: set
them in the app's own CSS instead, on `.fk`, pointing at the app's own colours. The ones that matter most:

```css
.fk {
  --fk-accent: var(--your-brand);          /* buttons, the selected tab, links */
  --fk-accent-bright: var(--your-brand);   /* In progress, glows */
  --fk-accent-text: var(--your-brand);     /* links and small labels on the background */
  --fk-accent-gradient: linear-gradient(145deg, var(--your-brand), var(--your-brand));
  --fk-card: var(--your-card);
  --fk-surface: var(--your-surface);
  --fk-text: var(--your-text);
  --fk-font: inherit;                      /* the app's font; the default */
}
```

Every component takes `theme`: `"dark"`, `"light"`, or `"auto"` (the default, which follows the reader's system).
If the app has its own light and dark switch, pass its current value.

## 4. The backend

### 4a. Supabase with Supabase Auth

1. Copy `supabase/migrations/20261103000000_testing_feedback.sql` into the app's `supabase/migrations/`, renamed with
   a timestamp later than the newest one there.
2. Apply it to the **local or development** database only: `npx supabase migration up` against a local stack, or
   the way this project already applies migrations. Production waits for the person's yes.
3. Add the first approver. In the SQL editor, or with psql against the database (never as a committed migration,
   because it holds a person's address):

   ```sql
   insert into public.feedback_members (email, name, role) values ('them@example.com', 'Their Name', 'approver');
   ```

   For a local stack that is reset often, the same line can go in `supabase/seed.sql`, which only runs locally.
4. Make the data layer once, from the client the app already signs people in with:

   ```ts
   import { createSupabaseApi } from './feedback/supabase';
   import { supabase } from './lib/supabase'; // the app's own browser client
   export const feedbackApi = createSupabaseApi(supabase);
   ```

5. **Confirm email** stays on in the Supabase dashboard (Authentication, Sign In / Providers, Email), and so does
   **Secure email change**. The kit only trusts an address its owner has confirmed. With confirmation off, someone
   could sign up with, or change their account to, the address of a person on the list. You cannot see this setting
   from code: put it in your report for the person to check (step 9).
6. **Look at the storage rules the project already has**, because Supabase joins them with "or", and a broad rule of
   the app's own also opens the kit's bucket. Run:

   ```sql
   select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';
   ```

   Any rule that does not name a `bucket_id` (for example "authenticated users can read, upload and delete
   everything") also lets people who are not on the list read or upload in `feedback-files`, and lets people delete
   files there. Do not change the app's rules yourself: tell the person which ones and suggest adding a
   `bucket_id <> 'feedback-files'` condition, or naming the app's own bucket.

### 4b. Your own roles or your own sign-in

Two functions in the migration are where the app meets the kit, and they are the only ones to change:

- `feedback_email()` says who is asking. It reads the confirmed address of the Supabase Auth user. With another
  sign-in that issues Supabase tokens (Clerk, Auth0 and others through third-party auth), read the address from
  `auth.jwt()` instead, and only when the token also says it is verified (`(auth.jwt() ->> 'email_verified')::boolean`
  or the provider's own claim). Return null for anything else.
- `feedback_role()` says what they may do: `approver`, `member`, `agent`, or null for anyone else. By default it reads
  `feedback_members`. If the app already keeps roles, for example in a `profiles` table, read them there and map
  them onto the three. If you do that, pass no `addPerson` and `removePerson` (the People tab then hides itself) and
  manage people the app's own way.

After changing either, run `npm run check:supabase` from the kit's clone against the local database (step 8).

### 4c. Another backend

The screens only ever talk to the `FeedbackApi` in `kit/api.ts`. Write an adapter that does the same against the
app's backend, and keep these rules **on the server**, where nobody can go around them:

1. Only people on the list see or touch anything.
2. Only whoever filed a ticket, or an approver, changes what it says. Anyone on the list moves it and comments.
3. An agent never marks a ticket Done or Won't do.
4. A ticket is marked Done only from In review, and never by whoever moved it there.
5. Every change is written to the history by the server, in words, never by the browser.
6. A file goes only into its own ticket, only as a picture, PDF or video, 50 MB at most.
7. A person reads only their own bell.

The sentences a refusal says are in `SAYS` in `kit/model.ts`; use them, and the screens show them as they are. Then
run the contract against the new adapter: `tests/contract.ts` takes five signed-in people and checks every rule.
`tests/local.test.ts` shows how to call it.

For the agent server, change the four tools in `mcp/tools.mjs` to call the same backend as an agent account.

### Trying it before the backend is ready

`createLocalApi` in `kit/local.ts` keeps everything in the browser, with the same rules. It is what the demo uses. It
is not shared between people, so it is for trying the screens, never for a team.

## 5. Put it in the app

**The page.** One route, with everything after it passed as `path`. Examples:

React Router:

```tsx
<Route path="/feedback/*" element={<FeedbackRoute />} />

function FeedbackRoute() {
  const rest = useParams()['*'] ?? '';
  const navigate = useNavigate();
  return <FeedbackPage api={feedbackApi} appName="Your app" areas={AREAS} path={rest} onNavigate={(p) => navigate(`/feedback/${p}`)} hrefFor={(p) => `/feedback/${p}`} />;
}
```

Next.js (App Router), in `app/feedback/[[...slug]]/page.tsx`:

```tsx
'use client';
import { useParams, useRouter } from 'next/navigation';

export default function Feedback() {
  const slug = (useParams<{ slug?: string[] }>().slug ?? []).join('/');
  const router = useRouter();
  return <FeedbackPage api={feedbackApi} appName="Your app" areas={AREAS} path={slug} onNavigate={(p) => router.push(`/feedback/${p}`)} hrefFor={(p) => `/feedback/${p}`} />;
}
```

A hash router, or no router at all: `useHashPath('feedback')` from the kit gives `path`, `go` and `hrefFor`, and
`onPage` says whether the page is open.

**The menu.** One item to the page, called "Testing and feedback" or "Feedback".

**The parts of the app.** `AREAS` is the menu's items in its order, then `'Something else'`:

```ts
export const AREAS = ['Dashboard', 'Projects', 'Billing', 'Settings', 'Something else'];
```

**The button.** Once, in the layout every signed-in page shares. It shows itself only to people on the list. Pass
the part of the app the person is on, so the form starts there:

```tsx
<FeedbackButton api={feedbackApi} areas={AREAS} area={currentArea} hrefFor={(p) => `/feedback/${p}`} onNavigate={(p) => navigate(`/feedback/${p}`)} />
```

It sends the page's path (never the query string or the part after `#`) and the screen size and browser. With a hash
router, pass `page` with the route, because the path is always `/`. If the app puts something secret in the path
itself (an invite or reset token, as in `/invite/abc123`), pass `page` with the route's pattern instead, such as
`/invite/[token]`.

**Next.js.** Every file of the kit starts with `'use client'`, so the button and the bell can go straight into a
server `layout.tsx`.

**Signing in and out.** With Supabase Auth the kit notices on its own. With another sign-in, give the button and the
bell `key={userId}` so they start again when the person changes.

**The bell.** In the top bar, beside whatever is there already:

```tsx
<FeedbackBell api={feedbackApi} hrefFor={(p) => `/feedback/${p}`} onNavigate={(p) => navigate(`/feedback/${p}`)} />
```

**Not React.** `model.ts`, `api.ts`, `local.ts` and `supabase.ts` are plain TypeScript and work anywhere. Port the
`.tsx` files to the app's framework, keep their words, their states and their class names, and `feedback.css` works as
it is.

## 6. The people

Approvers add people on the **People** tab: the address they sign in with, a name, and a role.

| Role | May |
|---|---|
| Approver | Everything a member may, change any ticket, and manage the list |
| Member | File, move, comment, and close a ticket someone else moved to In review. Change only their own |
| Agent | Read, comment, and move a ticket to New, In progress or In review. Never close one |

A client testing the app is a member. Everyone on the list sees every ticket, its files and comments, and each other's
names and addresses. The kit is made for a team and the people testing with it, so keep clients of different companies
on different lists (different apps or projects).

## 7. The agent

Skip this step if the person said no in step 1.

1. **An account for the agent.** Its own, never a person's. In the Supabase dashboard: Authentication, Users, Add
   user, with an address such as `feedback-agent@yourcompany.com`, a long random password, and "Auto Confirm User"
   on. Or with the admin API from a one-off script, if the service role key is already in the app's environment, with
   the password made inside the script and written straight to the file in point 3, never shown.

   **What else that account can reach.** To the app it is one more signed-in user. The feedback tables keep it to
   what an agent may do, but the app's own tables follow the app's own rules: a rule such as "any signed-in user can
   read" lets the agent's account read it too. Look at the app's policies (`select tablename, policyname, cmd, qual
   from pg_policies where schemaname = 'public'`) and tell the person what that account could read or change. Point
   the agent at a development or test project when the production one holds anything it should not see.
2. **On the list as an agent**, on the People tab or with the same SQL as step 4a and the role `agent`.
3. **The server.** Copy `mcp/` to `tools/feedback-mcp/` in the app and run `npm install` there (Node 20.6 or newer).
   Keep its settings **outside the project**, so the agent working in the project does not come across the password,
   for example in `~/.feedback-mcp/your-app.env`:

   ```
   FEEDBACK_SUPABASE_URL=https://your-project.supabase.co
   FEEDBACK_SUPABASE_ANON_KEY=the anon or publishable key
   FEEDBACK_AGENT_EMAIL=feedback-agent@yourcompany.com
   FEEDBACK_AGENT_PASSWORD=the password from point 1
   FEEDBACK_APP_URL=https://your-app.com
   FEEDBACK_TICKET_PATH=/feedback/tickets/{number}
   ```

   The anon key is the public one the browser already has. The server refuses a service role key, and refuses to run
   as any account that is not on the list as an agent.
4. **Tell Claude Code about it**, from the app's folder, with full paths:

   ```bash
   claude mcp add --scope local testing-feedback -- node --env-file=/home/you/.feedback-mcp/your-app.env /full/path/to/app/tools/feedback-mcp/server.mjs
   ```

5. **The skill.** Copy `claude/skills/feedback-queue/` to `.claude/skills/feedback-queue/` in the app. After that,
   "work the feedback queue" in Claude Code takes the next ticket, fixes it and hands it back for a person to test.

## 8. Check it

Run the app and go through these, as two different people where it says so:

1. As the approver, the page opens and the People tab is there.
2. File a ticket from the page, and one from the floating button on another page. The second carries that page.
3. Add a screenshot to a ticket and open it again.
4. As a member, try to mark an In progress ticket Done: it is refused, because Done comes only from In review. Move
   it to In review. As the same member, Done is refused with the reason. As the approver, mark it Done.
5. The approver's bell rang for the new tickets; the filer's bell rang when theirs moved.
6. With the agent: `list_tickets`, then `move_ticket` to In progress and In review on a test ticket. Ask it to move a
   ticket to Done: it cannot.
7. Look at the page at a phone's width and at a laptop's, in the app's light and dark themes.

With Supabase, the same checks run as a script against a **local** database. In the kit's clone:

```bash
npm install
```

Then put `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` of the local stack in `.env.check` there
(git ignores it), and:

```bash
npm run check:supabase
```

It makes five test accounts, runs every rule through the real Supabase adapter and the agent server, and takes it all
away again. It refuses a project that is not on this computer unless `FEEDBACK_CHECK_REMOTE=yes` is set, and it is
never for production.

## 9. Report

Tell the person, in plain words: what was added and where (each file), what was checked and how, what was not checked,
and what is left for them:

- the migration on production, when they say so;
- that **Confirm email** and **Secure email change** are on in the Supabase dashboard, which you cannot see;
- any storage rule of the app's that also opens `feedback-files` (step 4a, point 6);
- what the agent's account can reach in the app's own tables (step 7);
- adding the people who will test, and the agent's account if they skipped it.

## Taking it out again

Remove the page, the menu item, the button, the bell, the styles import and the `feedback` folder. For the database,
run `supabase/undo.sql`, then empty and delete the bucket `feedback-files` in the dashboard. Remove the agent with
`claude mcp remove testing-feedback` and delete `tools/feedback-mcp/`, `.claude/skills/feedback-queue/` and the
settings file outside the project.
