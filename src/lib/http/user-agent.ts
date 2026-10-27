// Lightweight signature match against known bot/crawler/monitoring-tool
// user-agent substrings — no external service, just enough to sort a daily
// visitor digest without treating every visitor as worth a paid lookup.
export const BOT_SIGNATURES = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'archiver',
  'facebookexternalhit',
  'discordbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'linkedinbot',
  'twitterbot',
  'pinterest',
  'headlesschrome',
  'phantomjs',
  'python-requests',
  'python-urllib',
  'curl/',
  'wget/',
  'java/',
  'go-http-client',
  'okhttp',
  'scrapy',
  'node-fetch',
  'axios/',
  'postmanruntime',
  'uptimerobot',
  'pingdom',
  'statuscake',
  'monitor',
  'ahrefs',
  'semrush',
  'mj12',
  'dotbot',
  'petalbot',
  'bytespider',
  'applebot',
  // Chrome on desktop Linux. On 2026-10-26 one automated browser with this exact string visited 413 different
  // addresses in 78 minutes, one page each, with no referrer, and made up 56% of 30 days of "human" views. A user
  // agent cannot tell it from a person on Linux Chrome, so real Linux Chrome visitors are counted as bots too, a few
  // in a hundred on a site for white-collar job seekers. Linux Firefox and Android Chrome do not match this string.
  '(x11; linux x86_64) applewebkit/537.36 (khtml, like gecko) chrome/',
]

export type UserAgentClass = 'human' | 'bot' | 'unknown'

export function classifyUserAgent(userAgent: string | null): UserAgentClass {
  if (!userAgent) return 'unknown'
  const lower = userAgent.toLowerCase()
  return BOT_SIGNATURES.some((signature) => lower.includes(signature)) ? 'bot' : 'human'
}

// Humans first, then unknown, then confirmed bots — for display ordering
// only, not a security control.
export const USER_AGENT_CLASS_SORT_ORDER: Record<UserAgentClass, number> = { human: 0, unknown: 1, bot: 2 }
