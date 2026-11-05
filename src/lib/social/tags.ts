import type { ChannelId } from '@/lib/social/channels'
import type { Fact } from '@/lib/social/facts'
import { textBudget } from '@/lib/social/posts'
import { layoffHandleRegistry } from '@/lib/social/tag-handles'

/**
 * Who can be tagged, and under what handle on each channel. Tags are added by code from a fact's `cites`, never written by the model,
 * so a post can only ever name an account that is listed here.
 *
 * Add an organization or researcher only after checking the handle is theirs:
 *   - Bluesky: a handle that is their own domain (dol.gov) or a verified profile; open bsky.app/profile/<handle> and confirm.
 *   - X: the verified account of the organization; confirm the handle by opening x.com/<handle>.
 * Leave a channel out when there is no verified handle there; the post then names the source in plain words and tags nobody.
 * Checked 2026-11-04 against the live profiles for the Bluesky entries below. No X handle has been verified yet.
 */
export interface Handles {
  name: string
  /** Without the @. */
  bluesky?: string
  x?: string
}

export const HANDLES: Record<string, Handles> = {
  dol: { name: 'U.S. Department of Labor', bluesky: 'dol.gov' },
  brookings: { name: 'Brookings Institution', bluesky: 'brookings.edu' },
  'federal-reserve': { name: 'Federal Reserve', bluesky: 'federalreserve.gov' },
  anthropic: { name: 'Anthropic', bluesky: 'anthropic.com' },
  revelio: { name: 'Revelio Labs', bluesky: 'reveliolabs.com' },
  nber: { name: 'National Bureau of Economic Research', bluesky: 'nber.org' },
  piie: { name: 'Peterson Institute for International Economics', bluesky: 'piie.com' },
  // State agencies (`agency:<state>`) and news outlets (`outlet:<site>`) that layoff posts may tag: see tag-handles.ts.
  ...layoffHandleRegistry(),
}

/** The site an outlet registry key is filed under: `www.` and any subdomain dropped down to a registered site. */
function outletKey(sourceUrl: string | null, registry: Record<string, Handles>): string | null {
  if (!sourceUrl) return null
  let host: string
  try { host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
  return Object.keys(registry).find((k) => k.startsWith('outlet:') && (host === k.slice(7) || host.endsWith(`.${k.slice(7)}`))) ?? null
}

/**
 * Who a layoff post tags: the state agency that runs unemployment and rapid response in the layoff's state, and, when a news story
 * is the source, that outlet. Never the employer, and never more than two accounts. A WARN filing is the state's own record, so it
 * tags the agency only; a state or outlet with no verified handle is skipped.
 */
export function layoffCites(l: { state: string | null; sourceUrl: string | null; kind: 'filing' | 'announcement' }, registry: Record<string, Handles> = HANDLES): string[] {
  const agency = l.state && registry[`agency:${l.state}`] ? [`agency:${l.state}`] : []
  const outlet = l.kind === 'announcement' ? outletKey(l.sourceUrl, registry) : null
  return [...(outlet ? [outlet] : []), ...agency].slice(0, 2)
}

/** The handles to tag on a channel for the organizations a fact cites. Unknown keys and channels without a handle are skipped. */
export function tagsFor(cites: string[] | undefined, channel: ChannelId, registry: Record<string, Handles> = HANDLES): string[] {
  if (channel !== 'bluesky' && channel !== 'x') return []
  const out: string[] = []
  for (const key of cites ?? []) {
    const h = registry[key]?.[channel]
    if (h && !out.includes(`@${h}`)) out.push(`@${h}`)
  }
  return out.slice(0, 3)
}

/** Adds "cc @handle" to a finished post, only if it still fits the channel's limit; a post that would overflow goes out untagged. */
export function withTags(text: string, fact: Pick<Fact, 'cites'>, channel: ChannelId, link: string, registry?: Record<string, Handles>): string {
  const tags = tagsFor(fact.cites, channel, registry)
  if (!tags.length) return text
  const tagged = `${text}\n\ncc ${tags.join(' ')}`
  return [...tagged].length <= textBudget(link, channel === 'x') ? tagged : text
}

/** Plain hashtags by topic, added by code after a draft passes the check so the writer never invents one (validate.ts still rejects them in a draft). */
const HASHTAGS: Partial<Record<Fact['topic'], string>> = {
  layoff: '#layoffs #jobsearch',
  help: '#laidoff #jobsearch',
  ranking: '#jobsearch #careers',
  skill: '#jobsearch #careers',
  'ai-pay': '#careers #AI',
}

/** Adds the topic's hashtags to a finished post when it has none and they fit the channel's limit; otherwise the post goes out as it is. */
export function withHashtags(text: string, fact: Pick<Fact, 'topic'>, channel: ChannelId, link: string): string {
  const tags = HASHTAGS[fact.topic]
  if (!tags || text.includes('#')) return text
  const tagged = `${text}\n\n${tags}`
  return [...tagged].length <= textBudget(link, channel === 'x') ? tagged : text
}
