// A ranking family ("AI skills") gets its own page at /rankings/topic/<slug>, so the hub shows one card per topic
// instead of every list in it.
export const topicSlug = (family: string) => family.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** One line under the topic's name on the hub card. */
export const TOPIC_BLURB: Record<string, string> = {
  'Entry-level': 'Where junior openings are most common.',
  Levels: 'Openings by seniority level.',
  AI: 'Where openings ask for AI skills.',
  'AI skills': 'Which AI skills and tools employers name.',
  Pay: 'Posted pay after the cost of living.',
  'Work style': 'Remote and hybrid openings.',
  'Job families': 'Rankings for each kind of work.',
  Industries: 'Openings and pay by industry.',
  'Industry markets': 'The best places for each industry.',
  'AI and jobs': 'How AI shows up in job postings.',
  'Function profiles': 'What employers ask for in each function.',
  'Industry profiles': 'What employers ask for in each industry.',
  Support: 'Help for people between jobs.',
  'Hiring and layoffs': 'Hiring and layoff activity by place.',
  Conferences: 'Where the professional conferences are.',
  'Work arrangements': 'On-site, hybrid and remote mixes.',
  Markets: 'Overall market strength by place.',
  Growth: 'Where job counts are growing.',
  'Best overall': 'The strongest all-round job markets.',
  Workforce: 'Workforce and training capacity.',
  Research: 'Research jobs and funding.',
  'Higher education': 'Colleges and the jobs near them.',
  Degrees: 'Which degrees match open jobs.',
}
