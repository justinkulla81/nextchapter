// Named AI crawlers and assistant fetchers. Matched by user-agent substring (case-insensitive). Only these are logged
// by the proxy, so the table stays small. SEARCH and USER_FETCH are the ones that put a page in front of a person.
export type AiCrawlerPurpose = 'TRAINING' | 'SEARCH' | 'USER_FETCH'

export type AiCrawler = { bot: string; vendor: string; purpose: AiCrawlerPurpose; match: string }

export const AI_CRAWLERS: AiCrawler[] = [
  { bot: 'GPTBot', vendor: 'OpenAI', purpose: 'TRAINING', match: 'gptbot' },
  { bot: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'SEARCH', match: 'oai-searchbot' },
  { bot: 'ChatGPT-User', vendor: 'OpenAI', purpose: 'USER_FETCH', match: 'chatgpt-user' },
  { bot: 'ClaudeBot', vendor: 'Anthropic', purpose: 'TRAINING', match: 'claudebot' },
  { bot: 'Claude-SearchBot', vendor: 'Anthropic', purpose: 'SEARCH', match: 'claude-searchbot' },
  { bot: 'Claude-User', vendor: 'Anthropic', purpose: 'USER_FETCH', match: 'claude-user' },
  { bot: 'anthropic-ai', vendor: 'Anthropic', purpose: 'TRAINING', match: 'anthropic-ai' },
  { bot: 'PerplexityBot', vendor: 'Perplexity', purpose: 'SEARCH', match: 'perplexitybot' },
  { bot: 'Perplexity-User', vendor: 'Perplexity', purpose: 'USER_FETCH', match: 'perplexity-user' },
  { bot: 'Google-Extended', vendor: 'Google', purpose: 'TRAINING', match: 'google-extended' },
  { bot: 'Google-NotebookLM', vendor: 'Google', purpose: 'USER_FETCH', match: 'google-notebooklm' },
  { bot: 'meta-externalagent', vendor: 'Meta', purpose: 'TRAINING', match: 'meta-externalagent' },
  { bot: 'meta-externalfetcher', vendor: 'Meta', purpose: 'USER_FETCH', match: 'meta-externalfetcher' },
  { bot: 'MistralAI-User', vendor: 'Mistral', purpose: 'USER_FETCH', match: 'mistralai-user' },
  { bot: 'DuckAssistBot', vendor: 'DuckDuckGo', purpose: 'USER_FETCH', match: 'duckassistbot' },
  { bot: 'Applebot-Extended', vendor: 'Apple', purpose: 'TRAINING', match: 'applebot-extended' },
  { bot: 'Amazonbot', vendor: 'Amazon', purpose: 'TRAINING', match: 'amazonbot' },
  { bot: 'CCBot', vendor: 'Common Crawl', purpose: 'TRAINING', match: 'ccbot' },
  { bot: 'Bytespider', vendor: 'ByteDance', purpose: 'TRAINING', match: 'bytespider' },
  { bot: 'cohere-ai', vendor: 'Cohere', purpose: 'TRAINING', match: 'cohere-ai' },
  { bot: 'YouBot', vendor: 'You.com', purpose: 'SEARCH', match: 'youbot' },
  { bot: 'Grok', vendor: 'xAI', purpose: 'USER_FETCH', match: 'grok' },
]

// Page families whose second segment is a record id or slug (one page per job, employer, school...). A crawler reads
// each of them once, so storing the full path made ~530,000 one-hit rows in 16 days. They are stored as `/<family>/*`.
// Families with a bounded, useful set of pages (places, salaries, skills, rankings, tools...) keep their full path.
const COLLAPSED_FAMILIES = new Set(['jobs', 'employers', 'prepared', 'conferences', 'higher-education', 'search-firms', 'associations', 'network'])

/** The path stored for a crawler hit: record pages become `/<family>/*`, everything else is kept as is. */
export function crawlerPathKey(path: string): string {
  const [, family, second] = path.split('/')
  return family && second && COLLAPSED_FAMILIES.has(family) ? `/${family}/*` : path
}

/** Days of crawler hits kept. The admin AI page reads 30 days; the rest is margin. */
export const AI_CRAWLER_RETENTION_DAYS = 35

export function matchAiCrawler(userAgent: string | null | undefined): AiCrawler | null {
  if (!userAgent) return null
  const lower = userAgent.toLowerCase()
  return AI_CRAWLERS.find((c) => lower.includes(c.match)) ?? null
}
