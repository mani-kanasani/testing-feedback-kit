// The words people read: on the screens, in the database's refusals, and in the docs. Plain, with no dash as
// punctuation and no exclamation marks, and the refusals the same in the browser and in the database.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAYS } from '../kit/model';
import { MIGRATION } from './pglite';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

/** The prose of a Markdown file: no code, no table rules, no list markers. */
function prose(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .split('\n')
    .filter((line) => !/^\s*\|?\s*-{3,}/.test(line))
    .map((line) => line.replace(/^\s*(-|\d+\.)\s+/, ''))
    .join('\n');
}

/** What a screen shows: JSX text and the strings in quotes. */
function shown(source: string) {
  const code = /[()=;[\]]/;
  const texts = [...source.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).filter((t) => /[a-z]{2,} [a-z]{2,}/i.test(t) && !code.test(t));
  const strings = [...source.matchAll(/'([^'\n]{12,})'|`([^`\n]{12,})`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, 'X')).filter((t) => / /.test(t));
  return [...texts, ...strings].join('\n');
}

const DOCS = ['README.md', 'INSTALL.md', 'PROMPT.md', 'SECURITY.md', 'CLAUDE.md', 'claude/skills/feedback-queue/SKILL.md'];
const SCREENS = readdirSync(`${root}/kit`).filter((f) => /\.tsx?$/.test(f)).map((f) => `kit/${f}`);
const NEVER = /\b(replaced|fired|guaranteed|certified|auditor|passive income|first mover|unclaimed|cut headcount)\b/i;

describe('the words', () => {
  for (const file of [...DOCS, ...SCREENS, 'mcp/tools.mjs']) {
    it(`${file} has no dash as punctuation and no exclamation mark`, () => {
      const text = file.endsWith('.md') ? prose(read(file)) : shown(read(file));
      expect(text.match(/[–—]/g) ?? [], 'long dashes').toEqual([]);
      expect(text.match(/\S - \S/g) ?? [], 'a hyphen used as a dash').toEqual([]);
      expect(text.match(/[A-Za-z]!(\s|$)/g) ?? [], 'exclamation marks').toEqual([]);
      expect(text.match(NEVER) ?? [], 'words we do not use').toEqual([]);
    });
  }

  it('says every refusal the same way in the browser and in the database', () => {
    const sql = read('supabase/migrations/20261103000000_testing_feedback.sql').replace(/''/g, "'");
    for (const [key, sentence] of Object.entries(SAYS)) expect(sql.includes(sentence), key).toBe(true);
    expect(MIGRATION.endsWith('20261103000000_testing_feedback.sql')).toBe(true);
  });
});
