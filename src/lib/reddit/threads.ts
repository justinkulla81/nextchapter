import 'server-only'
import { unstable_cache } from 'next/cache'
import { parseThreads, redditSearchUrl, type Thread } from '@/lib/reddit/todo'

const UA = 'Mozilla/5.0 (compatible; NextChapterBot/1.0; +https://launchyournextchapter.com)'

export interface ThreadLookup { threads: Thread[]; blocked: boolean }

/**
 * Recent Reddit threads that mention an employer's layoffs, from Reddit's public search feed. One request, short timeout. Reddit
 * often refuses requests from cloud hosts; then `blocked` is true and the page falls back to a search link.
 */
async function lookup(employer: string): Promise<ThreadLookup> {
  const url = `${redditSearchUrl(`${employer} layoffs`).replace('/search/?', '/search.rss?')}`
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/atom+xml' }, signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return { threads: [], blocked: true }
    return { threads: parseThreads(await res.text(), employer), blocked: false }
  } catch {
    return { threads: [], blocked: true }
  }
}

/** Cached for an hour per employer, so reloading the page never hits Reddit again. */
export const findThreads = (employer: string) => unstable_cache(() => lookup(employer), ['reddit-threads-v1', employer.toLowerCase()], { revalidate: 3600 })()
