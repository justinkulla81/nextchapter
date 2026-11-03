import { Children, type ReactNode, type ReactElement } from 'react'
import { JourneyPicker } from '@/components/home/JourneyPicker'
import { OwnerInquiry } from '@/components/capture/OwnerInquiry'
import { TrackedLink } from '@/components/marketing/TrackedLink'

// The pull-style way in on every public page: ask whether this is what the visitor wants, then show the one-click path to
// registration (or, for organizations, the inquiry). Three placements: the question under the heading, a slim strip mid-page, and
// the full closing band with the no-résumé journey email for people who are not ready. Pages never pass copy; the frames
// (TopicShell, SeoPage) derive everything from the page path, so a new page gets all three by using the frame.

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
  }
}

export const registerHref = (slug: string, spot: 'top' | 'mid' | 'bottom') => `/onboarding/desire?from=${spot}_${slug}`

export function PullCtaTop({ topic, slug, audience }: { topic: string; slug: string; audience: PullAudience }) {
  if (audience === 'org') {
    return (
      <section aria-label="For organizations" className="mt-8 flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-tint-plum via-white to-tint-sky p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight text-navy">Do you run this, hire for it or serve these people?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reach experienced job seekers where they already look, with your own page and your own numbers. A short call shows how.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <TrackedLink href="/for-organizations" event="pull_cta_clicked" properties={{ spot: 'top', audience, slug }} gtagEvent="pull_cta_clicked" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Yes, show me how</TrackedLink>
          <a href="#get-started" className="inline-flex h-12 items-center rounded-full border border-border bg-white px-5 text-sm font-medium text-navy hover:border-brand">Send me details</a>
        </div>
      </section>
    )
  }
  return (
    <section aria-label="Is this what you want?" className="mt-8 flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-tint-sky via-white to-tint-mint p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold tracking-tight text-navy">Is this what you&apos;re looking for?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Answer a few questions and we&apos;ll show how {topic.toLowerCase()} fits your background: matched jobs, a plain-language market read and a weekly plan. Free. No résumé needed.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <TrackedLink href={registerHref(slug, 'top')} event="pull_cta_clicked" properties={{ spot: 'top', audience, slug }} gtagEvent="pull_cta_clicked" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Yes, build my plan</TrackedLink>
        <a href="#get-started" className="inline-flex h-12 items-center rounded-full border border-border bg-white px-5 text-sm font-medium text-navy hover:border-brand">Not sure yet</a>
      </div>
    </section>
  )
}

/** A slim strip for the middle of a long page: one sentence, one button. */
export function PullCtaMid({ topic, slug, audience }: { topic: string; slug: string; audience: PullAudience }) {
  const org = audience === 'org'
  return (
    <aside aria-label="Next step" className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-navy">{org ? 'Want your organization on pages like this one?' : `Seen enough? See how ${topic.toLowerCase()} reads for your background.`}</p>
      <TrackedLink href={org ? '/for-organizations' : registerHref(slug, 'mid')} event="pull_cta_clicked" properties={{ spot: 'mid', audience, slug }} gtagEvent="pull_cta_clicked" className="inline-flex h-10 shrink-0 items-center rounded-full bg-action px-5 text-sm font-semibold text-action-foreground hover:brightness-95">
        {org ? 'See how it works' : 'Show me, free'}
      </TrackedLink>
    </aside>
  )
}

/** The closing band: register in one click, or leave an email without an account. */
export function PullCtaBottom({ topic, slug, audience, picker = true }: { topic: string; slug: string; audience: PullAudience; picker?: boolean }) {
  const source = `page:topic:${slug}`.slice(0, 80)
  if (audience === 'org') {
    return (
      <div id="get-started" className="scroll-mt-6">
        <OwnerInquiry
          who="Run this, hire for it or serve these people?"
          what="Leave your work email. We'll send how organizations use NextChapter to reach experienced job seekers."
          href="/for-organizations"
          hrefLabel="See how organizations use it"
          source={source}
          label={topic}
        />
      </div>
    )
  }
  return (
    <section id="get-started" aria-label="Get started" className="mt-8 scroll-mt-6 rounded-3xl bg-gradient-to-br from-brand to-light-blue p-6 text-white sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Do you want this for your own search?</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/90">A free account turns this page into your plan: a plain-language read on {topic.toLowerCase()}, jobs matched to you and a weekly action plan.</p>
      <TrackedLink href={registerHref(slug, 'bottom')} event="pull_cta_clicked" properties={{ spot: 'bottom', audience, slug }} gtagEvent="pull_cta_clicked" className="mt-4 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">Yes, start free</TrackedLink>
      {picker && (
        <div className="mt-6 rounded-2xl bg-white p-4 text-foreground sm:p-5">
          <p className="mx-auto max-w-xl text-center text-sm font-semibold text-navy">Not ready for an account? Get a first-week plan by email.</p>
          <JourneyPicker source={source} compact />
        </div>
      )}
    </section>
  )
}

/**
 * Puts the page's children together with the pull CTAs: the strip lands halfway down a long page, and any closing band the page
 * wrote itself (`isOwnBand`) is replaced by the shared one so a page never ends with two asks. Returns the body and the bottom.
 */
export function withPullCtas(children: ReactNode, ctx: { topic: string; slug: string; audience: PullAudience }, opts: { hasCapture: boolean; isOwnBand: (el: ReactElement) => boolean }) {
  const all = Children.toArray(children)
  const body = all.filter((c) => !(typeof c === 'object' && 'type' in c && opts.isOwnBand(c as ReactElement)))
  const at = Math.ceil(body.length / 2)
  const withMid = body.length >= 4 ? [...body.slice(0, at), <PullCtaMid key="pull-mid" {...ctx} />, ...body.slice(at)] : body
  // A page that already has the owner inquiry (capture) keeps it; it only gains the register band.
  const bottom = opts.hasCapture && ctx.audience === 'org' ? null : <PullCtaBottom {...ctx} picker={!opts.hasCapture} />
  return { body: withMid, bottom }
}

/** For pages that are not on a shared frame: drop in under the intro (`<PullTop name="Layoff tracker" path="/layoffs" />`). */
export function PullTop({ name, path, audience }: { name: string; path: string; audience?: PullAudience }) {
  const c = pullContext([{ name, path }])
  return <PullCtaTop {...c} audience={audience ?? c.audience} />
}

export function PullMid({ name, path, audience }: { name: string; path: string; audience?: PullAudience }) {
  const c = pullContext([{ name, path }])
  return <PullCtaMid {...c} audience={audience ?? c.audience} />
}

export function PullBottom({ name, path, audience }: { name: string; path: string; audience?: PullAudience }) {
  const c = pullContext([{ name, path }])
  return <PullCtaBottom {...c} audience={audience ?? c.audience} />
}
