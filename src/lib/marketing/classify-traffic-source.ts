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
  openai: 'ChatGPT',
  email: 'Email',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  x: 'Twitter/X',
  reddit: 'Reddit',
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
  ['gemini.google.com', 'Gemini'],
  ['copilot.microsoft.com', 'Copilot'],
  ['bing.com', 'Bing'],
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
