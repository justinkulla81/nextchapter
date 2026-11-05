import type { ReactNode, ReactElement } from 'react'
import { Children } from 'react'
import { JourneyPicker } from '@/components/home/JourneyPicker'
import { NextStepBox, type JourneyAsk } from '@/components/capture/NextStepBox'
import { orgCopyForSlug, pullCopyFor, type OrgCopy, type PullCopy } from '@/lib/capture/pull-copy'

// The pull-style way in on every public page: one navy box under the heading (NextStepBox). Pages never pass copy; the frames
// (TopicShell, SeoPage) derive everything from the page path, so a new page gets it by using the frame. There is deliberately
// no mid-page strip and no closing band: a page asks once.

export type PullAudience = 'seeker' | 'org'

// Pages written for organizations (workforce boards, job centers, colleges, search firms) get the organization version.
const ORG_ROOTS = new Set(['workforce-boards', 'economic-development', 'rapid-response', 'search-firms', 'nonprofits', 'job-centers', 'higher-education', 'associations', 'conferences', 'events', 'top-employers'])

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page'

export function pullContext(trail: { name: string; path: string }[]) {
  const last = trail[trail.length - 1]
  const root = (trail[0]?.path ?? '').split('/').filter(Boolean)[0] ?? ''
  const slug = slugOf((last?.path ?? '').replace(/^\//, ''))
  return {
    topic: last?.name ?? 'your search',
    slug,
    audience: (ORG_ROOTS.has(root) ? 'org' : 'seeker') as PullAudience,
    copy: ORG_ROOTS.has(root) ? orgCopyForSlug(slug) : pullCopyFor(last?.path ?? ''),
  }
}

/** The one box. People who are not ready open the first-week-plan email in place. */
export function PullCtaTop({ slug, audience, ask, copy }: { topic?: string; slug: string; audience: PullAudience; ask?: JourneyAsk; copy?: PullCopy | OrgCopy }) {
  const source = `page:topic:${slug}`.slice(0, 80)
  return <NextStepBox audience={audience} slug={slug} ask={ask} copy={audience === 'org' && !(copy && 'org' in copy) ? orgCopyForSlug(slug) : copy} extras={audience === 'seeker' ? <JourneyPicker source={source} compact /> : undefined} />
}

/**
 * Hands back the page's children without any pull block of their own: the box sits under the heading, and a closing band the
 * page wrote itself (`isOwnBand`) is dropped so a page never ends with a second ask. `bottom` stays for the frames' signature.
 */
export function withPullCtas(children: ReactNode, _ctx: { topic: string; slug: string; audience: PullAudience }, opts: { hasCapture: boolean; isOwnBand: (el: ReactElement) => boolean }) {
  const body = Children.toArray(children).filter((c) => !(typeof c === 'object' && 'type' in c && opts.isOwnBand(c as ReactElement)))
  return { body, bottom: null as ReactNode }
}

/** For pages that are not on a shared frame: drop in under the intro (`<PullTop name="Layoff tracker" path="/layoffs" />`). */
export function PullTop({ name, path, audience }: { name: string; path: string; audience?: PullAudience }) {
  const c = pullContext([{ name, path }])
  return <PullCtaTop {...c} audience={audience ?? c.audience} />
}
