import { StatStrip } from '@/components/prospects/Sections'
import { OrgClaimForm } from '@/components/prospects/OrgClaimForm'
import { QuickClaimForm } from '@/components/prospects/QuickClaimForm'
import { communityStatCards, sourceLine } from '@/lib/org-claims/format'
import { cleanDomain } from '@/lib/org-claims/rules'
import type { ClaimableOrg } from '@/lib/org-claims/org'
import type { CommunityStats } from '@/lib/org-claims/community-stats'
import { claimBenefits } from '@/lib/org-claims/claim-benefits'
import type { KitKind } from '@/lib/org-claims/org-kit'
import { Squiggle } from '@/components/ui/squiggle'

/**
 * The claim page for any organization in the CRM. It starts with what the page gives people (jobs, who is hiring, contacts, events, training,
 * other help), then the one action; the layoff-filing numbers for its place come last, as context.
 */
export function OrgClaimPage({ org, stats, peopleCount = null, page = null }: { org: ClaimableOrg; stats: CommunityStats | null; peopleCount?: number | null; page?: { kind: KitKind; path: string } | null }) {
  const cards = communityStatCards(stats)
  const domain = cleanDomain(org.emailDomain)
  // An employer picks which section to claim and a university picks the whole institution or one school, so those keep the full form.
  // Every other organization (a workforce board, job center, economic development group, nonprofit) claims with an email and nothing else.
  const simple = !org.orgTypes.includes('EMPLOYER') && !org.orgTypes.includes('UNIVERSITY')
  const benefits = claimBenefits(page?.kind)
  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm">
        <p className="text-xl font-bold tracking-tight text-navy">NextChapter</p>
        {page && <a href={page.path} className="font-medium text-brand underline underline-offset-4">See the page we built for {org.name}</a>}
      </header>

      {simple ? (
        <section id="claim" aria-labelledby="org-claim-h" className="rounded-3xl bg-navy p-6 text-white sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Free · for {org.name}</p>
          <h1 id="org-claim-h" className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl [text-wrap:balance]">Claim the {org.name} page</h1>
          <Squiggle className="mt-3 text-white/70" />
          <p className="mt-5 max-w-2xl text-lg text-white/85">
            We built this page from public data, and it is free for the people who find it. Enter your work email. We check that you run {org.name}, then email you a link to your free workspace.
          </p>
          <div className="mt-7 max-w-2xl">
            <QuickClaimForm slug={org.slug} orgName={org.name} />
          </div>
          {peopleCount != null && (
            <p className="mt-5 text-base text-white/85">{peopleCount.toLocaleString('en-US')} {peopleCount === 1 ? 'person has' : 'people have'} already connected with {org.name} on NextChapter.</p>
          )}
        </section>
      ) : (
        <section id="claim" className="space-y-5 rounded-3xl bg-navy p-6 text-white sm:p-10" aria-labelledby="org-claim-h">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Free · for {org.name}</p>
          <h1 id="org-claim-h" className="max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl [text-wrap:balance]">Claim the {org.name} page</h1>
          <Squiggle className="mt-3 text-white/70" />
          <p className="max-w-2xl text-lg text-white/85">Claiming confirms that you work at {org.name}. We email a one-time link to your work address, and the claim counts once you use it.</p>
          <div className="rounded-2xl bg-white p-5 text-navy sm:p-6">
            <OrgClaimForm slug={org.slug} orgName={org.name} domain={domain} sections={org.orgTypes.includes('EMPLOYER')} units={org.orgTypes.includes('UNIVERSITY')} />
          </div>
        </section>
      )}

      <section className="py-12" aria-labelledby="gives-h">
        <h2 id="gives-h" className="font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">What your page gives people</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 text-base text-navy">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-orange" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      {stats && (
        <section className="space-y-4 border-t border-border py-10" aria-labelledby="context-h">
          <h2 id="context-h" className="font-serif text-xl font-semibold tracking-tight text-navy">Community context</h2>
          {cards.length ? (
            <>
              <StatStrip stats={cards} />
              <p className="text-xs text-muted-foreground">{sourceLine(stats)}</p>
            </>
          ) : (
            <p className="max-w-2xl text-sm text-muted-foreground">We hold no layoff-notice data for {stats.place.stateName} in this period, so we show no numbers.</p>
          )}
        </section>
      )}

      <p className="border-t border-border pt-6 text-xs text-muted-foreground">
        This page is unlisted and shows no personal information. The numbers are public filings, not figures from {org.name}.
      </p>
    </main>
  )
}
