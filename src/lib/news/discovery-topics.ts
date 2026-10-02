/**
 * What the daily search looks for, and the words it searches with.
 *
 * An explicit list, grouped the way the subjects relate: the labour market
 * as measured, layoffs as they happen, who is hit hardest, the way back in,
 * and the decision to stay or go. Adding a topic is adding a line here.
 * `query` is what is sent to the news search; `label` is what Market Pulse
 * shows beside each link it found.
 */
export const DISCOVERY_TOPICS = [
  // The labour market, measured
  { key: 'unemployment_data', label: 'Unemployment data', query: 'unemployment rate jobs report' },
  { key: 'long_term_unemployment', label: 'Long-term unemployment', query: '"long-term unemployment"' },
  { key: 'age_unemployment', label: 'Age-related unemployment', query: 'older workers unemployment age discrimination' },
  // Layoffs
  { key: 'layoffs', label: 'Layoffs', query: 'layoffs announced' },
  { key: 'warn_filings', label: 'WARN filings', query: '"WARN notice" layoffs' },
  // AI and work
  { key: 'ai_displacement', label: 'AI job displacement', query: 'AI job displacement' },
  { key: 'ai_retraining', label: 'AI retraining for mid-careers', query: 'AI reskilling mid-career workers' },
  // The way back in
  { key: 'family_leave_returnships', label: 'Family leave returnships', query: 'returnship family leave caregivers' },
  { key: 'maternity_leave_returnships', label: 'Maternity leave returnships', query: 'returnship maternity leave return to work' },
  // Stay or go
  { key: 'feeling_stuck', label: 'Feeling stuck in your job', query: 'feeling stuck in your job career' },
  { key: 'thinking_about_quitting', label: 'Thinking about quitting', query: 'thinking about quitting your job' },
] as const

export const DISCOVERY_TOPIC_LABELS: string[] = DISCOVERY_TOPICS.map((t) => t.label)
