import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { peopleWord } from '@/lib/affiliations/public-count-rules'

/**
 * The offer to a job seeker on a workforce board's page: a free Market Reality Assessment. When the board's colors are known the band is
 * painted in them (the page wrapper sets --org-*, see OrgPageView); otherwise it uses NextChapter's own colors. The line that this page is
 * independent stays either way. The number of people connected shows only once it is over the floor (public-count-rules.ts).
 */
export function OrgCandidateBand({ orgName, branded, peopleCount, properties }: { orgName: string; branded: boolean; peopleCount: number | null; properties: Record<string, unknown> }) {
  return (
    <section
      aria-labelledby="candidate-offer"
      className={`mt-8 rounded-2xl p-6 sm:p-8 ${branded ? '' : 'bg-navy text-white'}`}
      style={branded ? { backgroundColor: 'var(--org-1)', color: 'var(--org-1-ink)' } : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] opacity-80">Independent page. Not run by or affiliated with {orgName}.</p>
      <h2 id="candidate-offer" className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:balance]">Looking for work in this area? See where you stand.</h2>
      <p className="mt-3 max-w-2xl text-base opacity-90">
        Get a free Market Reality Assessment: how your experience matches what employers here are hiring for, the jobs open near you, and a plan for the weeks ahead.
      </p>
      {peopleCount != null && (
        <p className="mt-3 text-sm opacity-90">{peopleCount.toLocaleString('en-US')} {peopleWord(peopleCount)} {peopleCount === 1 ? 'has' : 'have'} connected with {orgName} on NextChapter.</p>
      )}
      <TrackedLink
        href={MARKET_REALITY_START_HREF}
        event="org_page_candidate_cta_clicked"
        properties={{ ...properties, branded }}
        className={`mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold ${branded ? 'bg-[var(--org-cta)] text-[var(--org-cta-ink)] hover:opacity-90' : 'bg-orange text-navy hover:bg-orange/90'}`}
      >
        Get your free assessment
      </TrackedLink>
    </section>
  )
}
