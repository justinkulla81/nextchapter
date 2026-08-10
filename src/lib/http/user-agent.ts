// Lightweight signature match against known bot/crawler/monitoring-tool
// user-agent substrings — no external service, just enough to sort a daily
// visitor digest without treating every visitor as worth a paid lookup.
const BOT_SIGNATURES = [
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
