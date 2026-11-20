import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { peopleWord } from '@/lib/affiliations/public-count-rules'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { SituationChoice, type SituationAsk } from '@/components/capture/SituationChoice'

/**
 * The offer to a job seeker on a workforce board's page: a free Market Reality Assessment. When the board's colors are known the band is white
 * with a stripe and label in the primary (the page wrapper sets --org-*, see OrgPageView), not a full block of a loud brand color
 * such as a bright red; otherwise it uses NextChapter's own colors. The line that this page is
 * independent stays either way. The number of people connected shows only once it is over the floor (public-count-rules.ts).
 */
export function OrgCandidateBand({ orgName, branded, peopleCount, properties, heading = 'Looking for work in this area? See where you stand.', independent = `Independent page. Not run by or affiliated with ${orgName}.`, situations }: {
  orgName: string
  branded: boolean
  peopleCount: number | null
  properties: Record<string, unknown>
  /** The headline, for pages where "in this area" does not fit (a layoff, a job). */
  heading?: string
  /** The line saying this page is independent of the organization it is about. */
  independent?: string
  /** A place page: the one button becomes four situation choices that carry the place into onboarding. */
  situations?: SituationAsk
}) {
  return (
    <section
      aria-labelledby="candidate-offer"
      className={`mt-8 rounded-2xl p-6 sm:p-8 ${branded ? 'border border-border border-t-[6px] bg-white text-navy' : 'bg-navy text-white'}`}
      style={branded ? { borderTopColor: 'var(--org-1)' } : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] opacity-80" style={branded ? { color: 'var(--org-1-text)', opacity: 1 } : undefined}>{independent}</p>
      <h2 id="candidate-offer" className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:balance]">{heading}</h2>
      <p className="mt-3 max-w-2xl text-base opacity-90">
        Not sure you match what employers here are hiring for? Get a free read on your fit, the jobs open near you and a plan for the weeks ahead.
      </p>
      {peopleCount != null && (
        <p className="mt-3 text-sm opacity-90">{peopleCount.toLocaleString('en-US')} {peopleWord(peopleCount)} {peopleCount === 1 ? 'has' : 'have'} connected with {orgName} on NextChapter.</p>
      )}
      {situations ? <SituationChoice ask={situations} tone={branded ? 'light' : 'dark'} /> : <TrackedLink
        href={MARKET_REALITY_START_HREF}
        event="org_page_candidate_cta_clicked"
        properties={{ ...properties, branded }}
        className={`mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold ${branded ? 'bg-[var(--org-1)] text-[var(--org-1-ink)] hover:opacity-90' : 'bg-orange text-navy hover:bg-orange/90'}`}
      >
        <AssessmentCtaLabel>Show me jobs near me</AssessmentCtaLabel>
      </TrackedLink>}
    </section>
  )
}
