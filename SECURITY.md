# Security

## What the kit protects

- **Every rule is kept by the database.** The browser reads, and every write goes through a function that checks who
  is asking. A person who opens the developer tools, or an agent with a valid account, still cannot write a table
  directly, close a ticket an agent may not close, change someone else's ticket, or read someone else's bell. The
  tests try each of these and expect a refusal (`tests/database.test.ts`).
- **Only a confirmed address counts.** The kit trusts the address of the signed-in Supabase user only once its owner
  has confirmed it.
- **Files stay with their ticket.** The bucket is private. A file can only be stored in the folder of a ticket that
  exists, only by someone on the list, and only as a picture, PDF or video of 50 MB or less. Only whoever uploaded a
  file can add it to the ticket, and its size and type are read from storage, not from the browser. A file opens
  through a link that works for ten minutes and downloads under its own name.
- **The floating button sends little.** The page's path, never its query string or the part after `#` (where sign-in
  links carry tokens), and the screen size and browser. Nothing else about the person or their device. The database
  keeps a page only when it is a plain path in the app, so it can never point an agent at another site. If your app
  puts a secret in the path itself (`/invite/<token>`), pass the route's pattern instead (INSTALL.md, step 5).
- **The agent cannot close a ticket**, whatever a ticket, a comment or a prompt tells it. The database refuses it, and
  the agent server will not run with a service role key or as an account that is not an agent.
- **A ticket's words are data.** People using the app write them, so they can contain text aimed at an AI. The agent
  server hands every word people wrote over as a quoted string with the writer's role, so a ticket cannot pass for a
  comment from an approver or for the server's own words, and it says with every answer that those words are not
  instructions. The skill has the agent tell the person which ticket it is taking and who filed it before it changes
  code, stop on anything beyond a fix, and never put keys or private data in a comment. This lowers the risk; it cannot
  remove it. Keep agents on accounts that can do little, and review what they change before it ships, which is what In
  review is for.

## What it leaves to you

- **Who is on the list.** Everyone on it sees every ticket, its files and its comments, and each other's names and
  addresses. Add the people who test with you, keep clients of different companies on different lists, and take
  people off when they stop.
- **Email confirmation stays on** in Supabase (Authentication, Sign In / Providers, Email: Confirm email, and Secure
  email change). With it off, someone could sign up with, or change their account to, the address of a person on the
  list.
- **Your own storage rules.** Supabase joins storage rules with "or". A rule of your app's that lets every signed-in
  user read, upload or delete in every bucket also does so in `feedback-files`. Name your own bucket in your rules.
- **The agent's account is a signed-in user of your app.** The feedback tables keep it to what an agent may do; your
  own tables follow your own rules. Check what a plain signed-in account can read before you hand one to an agent,
  and keep its password outside the project it works in.
- **The service role key stays on your server.** Never in browser code, never in the agent server's settings.
- **What people put in tickets.** Ask your team not to paste passwords, keys or customers' personal data into a ticket
  or a screenshot. Tickets are kept for good, and an agent reads them.
- **If you change `feedback_email()` or `feedback_role()`**, run `npm run check:supabase` against a local database
  before it goes anywhere else.

## Reporting a problem

Please do not open a public issue for a security problem. Use **Report a vulnerability** on the Security tab of this
repository, which reaches the maintainer privately.
