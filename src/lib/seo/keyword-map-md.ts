import { KEYWORD_CLUSTERS, NO_TARGET_PAGES } from './keywords'

/** The text of docs/seo/keyword-map.md, generated from KEYWORD_CLUSTERS. Run `npm run seo:keyword-map` to rewrite the file. */
export function keywordMapMarkdown(): string {
  const lines: string[] = [
    '# Keyword map',
    '',
    'Generated from `src/lib/seo/keywords.ts` by `npm run seo:keyword-map`. Do not edit by hand: change the data, then regenerate.',
    '`src/test/seo-keyword-map.test.ts` fails if this file is out of date, if a phrase has two owners, or if an owner page does not exist.',
    '',
    'Each search phrase has exactly one owning page, so pages do not compete with each other. A page that touches a phrase it does not own links to the owner instead of repeating the phrase in its title.',
    '',
    'Page families (one page per state, employer, job and so on) get their title, description and headline from `src/lib/seo/templates.ts`.',
    '',
    `Pages with no target phrase (legal, security, editorial, per-item pages): ${NO_TARGET_PAGES.map((p) => `\`${p}\``).join(', ')}.`,
    '',
    `${KEYWORD_CLUSTERS.length} clusters, ${KEYWORD_CLUSTERS.reduce((n, c) => n + 1 + c.secondary.length, 0)} phrases.`,
    '',
    '| Owner page | Kind | Primary phrase | Searcher wants | Other phrases it owns |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const c of KEYWORD_CLUSTERS) {
    lines.push(`| \`${c.owner}\` | ${c.kind} | ${c.primary} | ${c.intent} | ${c.secondary.join('; ')} |`)
  }
  lines.push('', '## Titles and descriptions', '', 'Title is shown before the site suffix " | NextChapter".', '')
  for (const c of KEYWORD_CLUSTERS) {
    if (!c.seo) continue
    lines.push(`### \`${c.owner}\``, '', `- Title: ${c.seo.title}`, `- Description: ${c.seo.description}`, ...(c.seo.h1 ? [`- H1: ${c.seo.h1}`] : []), '')
  }
  return lines.join('\n')
}
