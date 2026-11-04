import type { ChannelId } from '@/lib/social/channels'
import type { Fact } from '@/lib/social/facts'
import { textBudget } from '@/lib/social/posts'

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
