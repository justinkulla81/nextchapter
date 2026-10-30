// Buckets a HomepageVisitEvent row into a human-readable traffic source for
// the admin Visitors report. Checks, in order:
//   1. An explicit utm_source query param on the landing path — intentional
//      tagging always wins over a guess from the referrer.
//   2. The visit's `referrer` (document.referrer, captured client-side —
//      see HomepageVisitTracker.tsx's own comment on why the old
//      server-side Referer-header approach never worked for this).
//   3. Falls back to "Direct" (no referrer at all) or "Other" (a referrer
//      exists but isn't one of the named buckets below) — "Other" shows
//      the actual hostname rather than hiding it, since an admin deciding
//      whether to add a new named bucket needs to see what's showing up.
//
// Historical rows recorded before the referrer-capture fix will show
// "Internal" here (their stored referrer is the site's own domain, a
// leftover of the old bug) rather than a real external source — there's no
// way to recover the true origin for those retroactively.

const UTM_SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  youtube: 'YouTube',
  chatgpt: 'ChatGPT',
  // ChatGPT appends ?utm_source=chatgpt.com to links it cites, so the domain
  // form is the common one in the wild.
  'chatgpt.com': 'ChatGPT',
  openai: 'ChatGPT',
  perplexity: 'Perplexity',
  'perplexity.ai': 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Copilot',
  grok: 'Grok',
  'grok.com': 'Grok',
  meta_ai: 'Meta AI',
  'meta.ai': 'Meta AI',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
  poe: 'Poe',
  // Set by Google's own job listings (Google for Jobs structured data), not by us.
  google_jobs_apply: 'Google for Jobs',
  email: 'Email',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  x: 'Twitter/X',
  reddit: 'Reddit',
  // Our own feeds and social posts tag their links (feedLink, social/run.ts), so these are exact, not guessed.
  rss: 'RSS feed',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  bing: 'Bing',
  direct: 'Direct',
}

// Hostname suffix -> label. Checked via `hostname === domain ||
// hostname.endsWith('.' + domain)` so e.g. "www.google.com" and
// "mail.google.com" both match "google.com" — the mail.* case is
// intercepted by EMAIL_DOMAINS first (see classify()) so it isn't
// swallowed by the broader Google entry.
const REFERRER_DOMAIN_LABELS: [domain: string, label: string][] = [
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['chatgpt.com', 'ChatGPT'],
  ['chat.openai.com', 'ChatGPT'],
  ['perplexity.ai', 'Perplexity'],
  ['claude.ai', 'Claude'],
  ['gemini.google.com', 'Gemini'],
  ['copilot.microsoft.com', 'Copilot'],
  ['grok.com', 'Grok'],
  ['x.ai', 'Grok'],
  ['meta.ai', 'Meta AI'],
  ['chat.mistral.ai', 'Mistral'],
  ['chat.deepseek.com', 'DeepSeek'],
  ['poe.com', 'Poe'],
  ['you.com', 'You.com'],
  ['bing.com', 'Bing'],
  ['duckduckgo.com', 'DuckDuckGo'],
  ['search.yahoo.com', 'Yahoo'],
  ['ecosia.org', 'Ecosia'],
  ['search.brave.com', 'Brave Search'],
  ['google.com', 'Google'],
  ['facebook.com', 'Facebook'],
  ['instagram.com', 'Instagram'],
  ['linkedin.com', 'LinkedIn'],
  ['lnkd.in', 'LinkedIn'],
  ['twitter.com', 'Twitter/X'],
  ['x.com', 'Twitter/X'],
  ['t.co', 'Twitter/X'],
  ['reddit.com', 'Reddit'],
]

// Web-based mail clients are the only case where a referrer survives a
// clicked email link at all — most native mail apps strip it entirely
// (those show up as "Direct" below, which is the honest answer: there's no
// signal to classify them by without UTM tagging on the link itself).
const EMAIL_DOMAINS = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.yahoo.com']

function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function extractUtmSource(path: string | null): string | null {
  if (!path) return null
  const queryStart = path.indexOf('?')
  if (queryStart === -1) return null
  const params = new URLSearchParams(path.slice(queryStart + 1))
  return params.get('utm_source')
}

export function classifyTrafficSource(path: string | null, referrer: string | null): string {
  const utmSource = extractUtmSource(path)?.trim().toLowerCase()
  if (utmSource) {
    return UTM_SOURCE_LABELS[utmSource] ?? utmSource.replace(/^\w/, (c) => c.toUpperCase())
  }

  if (!referrer) return 'Direct'

  let hostname: string
  try {
    hostname = new URL(referrer).hostname.toLowerCase()
  } catch {
    return 'Direct'
  }

  // Hardcoded alongside the env-var-derived value (not instead of it) —
  // relying on NEXT_PUBLIC_APP_URL alone is fragile in contexts where it's
  // unset or points at localhost (tests, one-off scripts), and this
  // classifier needs to recognize the real production domain regardless.
  const internalHostnames = new Set(['launchyournextchapter.com', 'localhost'])
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      internalHostnames.add(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase())
    }
  } catch {
    // Malformed env var — the hardcoded set above still covers the real cases.
  }
  if ([...internalHostnames].some((domain) => hostnameMatches(hostname, domain))) return 'Internal'

  if (EMAIL_DOMAINS.some((domain) => hostnameMatches(hostname, domain))) return 'Email'

  for (const [domain, label] of REFERRER_DOMAIN_LABELS) {
    if (hostnameMatches(hostname, domain)) return label
  }

  return `Other (${hostname})`
}

// Rolls the specific labels above into the handful of buckets the admin
// Visitors report charts. Anything not named here (an "Other (host)" label,
// a custom utm_source) lands in 'Other sites' so nothing silently vanishes.
export type TrafficSourceGroup =
  | 'AI assistants'
  | 'Google for Jobs'
  | 'Search engines'
  | 'Social'
  | 'Email'
  | 'RSS feeds'
  | 'Direct'
  | 'Internal'
  | 'Other sites'

const AI_ASSISTANTS = new Set(['ChatGPT', 'Perplexity', 'Gemini', 'Claude', 'Copilot', 'Grok', 'Meta AI', 'Mistral', 'DeepSeek', 'Poe', 'You.com'])
const SEARCH_ENGINES = new Set(['Google', 'Bing', 'DuckDuckGo', 'Yahoo', 'Ecosia', 'Brave Search'])
const SOCIAL = new Set(['YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'Twitter/X', 'Reddit', 'Bluesky', 'Mastodon', 'Threads', 'Telegram', 'Discord', 'Slack'])

export function trafficSourceGroup(label: string): TrafficSourceGroup {
  if (AI_ASSISTANTS.has(label)) return 'AI assistants'
  if (label === 'Google for Jobs') return 'Google for Jobs'
  if (SEARCH_ENGINES.has(label)) return 'Search engines'
  if (SOCIAL.has(label)) return 'Social'
  if (label === 'Email') return 'Email'
  if (label === 'RSS feed') return 'RSS feeds'
  if (label === 'Direct') return 'Direct'
  if (label === 'Internal') return 'Internal'
  return 'Other sites'
}
