import type { Fact } from '@/lib/social/facts'
import type { LinkCard } from '@/lib/social/clients'

/** What each kind of post's link card says under its title: what the reader finds on the page. */
const DESCRIPTION: Record<string, string> = {
  'warn-filing': 'What was filed, and what to do if you are affected.',
  'layoff-announcement': 'What was reported, and what to do if you are affected.',
  'ranking-story': 'The full list, with every place ranked.',
  'skill-story': 'Who is hiring for it, and what it pairs with.',
  'ai-pay-story': 'The method and the data behind the comparison.',
  'help-story': 'What the state pays and how to file.',
  'press-weekly': 'The data, the charts and how to cite them.',
  'daily-layoffs': 'Every notice, with the state record.',
  'weekly-layoffs': 'Every notice, with the state record.',
  report: 'The monthly NextChapter White Collar Employment Report.',
  rankings: 'All of this month\'s job market lists.',
}

const SENTENCE_MAX = 110

/**
 * The link card text for a post: the title is the post's first sentence (so the card says what this post says, not the page's generic
 * title) and the description is what the page holds, by kind of post.
 */
export function cardFor(fact: Pick<Fact, 'campaign' | 'lines'>, text: string): LinkCard {
  const body = text.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  const first = body.split(/(?<=[.?])\s/)[0] ?? ''
  const title = (first || fact.lines[0] || 'NextChapter').replace(/[.]+$/, '')
  return {
    title: title.length > SENTENCE_MAX ? `${title.slice(0, SENTENCE_MAX - 1).trimEnd()}…` : title,
    description: DESCRIPTION[fact.campaign] ?? 'Free layoff and job market data from NextChapter.',
  }
}
