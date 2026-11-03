# Working in this repository

This is the Testing and Feedback Kit itself. If you were asked to add the kit to an app, you are in the wrong file:
read [INSTALL.md](INSTALL.md) and follow it.

## Layout

- `kit/model.ts` is the rules and the words. The database (`supabase/migrations/`) keeps the same rules with the same
  sentences. Change one, change the other, and the tests in `tests/` with them.
- `kit/api.ts` is the one interface the screens use. `kit/local.ts` and `kit/supabase.ts` implement it.
- `tests/contract.ts` is the story every adapter must pass. `tests/pglite.ts` runs the real migration in an
  in-process Postgres with the parts of Supabase it uses stood in.
- `mcp/tools.mjs` is the agent server's four tools; `mcp/server.mjs` starts them.
- `demo/` is an invented app around the kit. Nothing in it is a real person or company.

## Before you call a change done

```bash
npm run check
```

That is the type check and every test. For a change to the database or the Supabase adapter, also run
`npm run check:supabase` against a local Supabase (`.env.check`, which git ignores). For a change on screen, run
`npm run demo` and look at it at 1440, 1100 and 390 pixels wide, dark and light.

## Words

Plain words, short sentences. No dashes as punctuation, no exclamation marks, no emoji. A refusal says what happened
and what to do instead.
