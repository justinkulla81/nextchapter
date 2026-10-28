import { StatStrip } from '@/components/prospects/Sections'
import { OrgClaimForm } from '@/components/prospects/OrgClaimForm'
import { communityStatCards, sourceLine } from '@/lib/org-claims/format'
import { cleanDomain } from '@/lib/org-claims/rules'
import type { ClaimableOrg } from '@/lib/org-claims/org'
import type { CommunityStats } from '@/lib/org-claims/community-stats'
import { claimBenefits } from '@/lib/org-claims/claim-benefits'
import type { KitKind } from '@/lib/org-claims/org-kit'

/**
 * The claim page for any organization in the CRM. It starts with what the page gives people (jobs, who is hiring, contacts, events, training,
 * other help), then the one action; the layoff-filing numbers for its place come last, as context.
 */
export function OrgClaimPage({ org, stats, peopleCount = null, page = null }: { org: ClaimableOrg; stats: CommunityStats | null; peopleCount?: number | null; page?: { kind: KitKind; path: string } | null }) {
  const cards = communityStatCards(stats)
  const domain = cleanDomain(org.emailDomain)
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 text-sm">
        <p className="font-semibold text-navy">NextChapter <span className="font-normal text-muted-foreground">· page for {org.name}</span></p>
        <a href="#claim" className="rounded-full bg-orange px-4 py-1.5 font-medium text-navy hover:bg-orange/90">Claim this page</a>
      </header>

      <section className="space-y-6 py-12" aria-labelledby="org-claim-h">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">For {org.name}</p>
        <h1 id="org-claim-h" className="font-serif text-4xl font-semibold leading-tight tracking-tight text-navy sm:text-5xl [text-wrap:balance]">The {org.name} page</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          We built a page for {org.name} from public data. It is free for the people who find it. Claiming it makes it yours.
        </p>
        {peopleCount != null && (
          <p className="max-w-2xl text-lg text-navy">{peopleCount.toLocaleString('en-US')} {peopleCount === 1 ? 'person has' : 'people have'} already connected with {org.name} on NextChapter.</p>
        )}
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">What your page gives people</h2>
          <ul className="mt-3 grid gap-2 text-base text-navy sm:grid-cols-2">
            {claimBenefits(page?.kind).map((b) => <li key={b} className="flex gap-2"><span aria-hidden className="text-orange">•</span>{b}</li>)}
          </ul>
          {page && (
            <p className="mt-4 text-sm"><a href={page.path} className="font-medium text-brand underline underline-offset-4">See your page</a></p>
          )}
        </div>
      </section>

      <section id="claim" className="space-y-5 border-t border-border py-10" aria-labelledby="claim-h">
        <h2 id="claim-h" className="font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Claim this page for {org.name}</h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <p className="text-muted-foreground">Claiming confirms that you work at {org.name}. We email a one-time link to your work address, and the claim counts once you use it.</p>
          <OrgClaimForm slug={org.slug} orgName={org.name} domain={domain} sections={org.orgTypes.includes('EMPLOYER')} />
        </div>
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
