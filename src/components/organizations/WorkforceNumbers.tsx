import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AudienceSection } from '@/components/organizations/AudienceShell'
import { WorkforceStatsTracker } from '@/components/organizations/WorkforceStatsTracker'
import { loadEntryLevelLine, loadWorkforceNumbers } from '@/lib/marketing/workforce-numbers'

/**
 * "By the numbers" for workforce boards: live counts from the board, the skills taxonomy, the
 * pivot map and the learning library (src/lib/marketing/workforce-numbers.ts). A figure that
 * fails to load drops its tile; if nothing loads, the section is not rendered.
 */
export async function WorkforceNumbers({ page }: { page: string }) {
  const [groups, entryLine] = await Promise.all([loadWorkforceNumbers(), loadEntryLevelLine()])
  if (groups.length === 0) return null
  const keys = groups.flatMap((g) => g.tiles.map((t) => t.key))
  return (
    <AudienceSection id="by-the-numbers" title="By the numbers">
      <WorkforceStatsTracker page={page} tiles={keys}>
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{g.title}</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.tiles.map((t) => (
                  <li key={t.key} className="rounded-2xl bg-muted/40 p-5">
                    <p className="font-display text-3xl font-semibold tracking-tight text-ink">{t.value}</p>
                    <p className="mt-1 font-semibold text-ink">{t.label}</p>
                    {t.detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {entryLine && <p className="mt-6 text-base text-ink">{entryLine}</p>}
        <p className="mt-6 text-sm text-muted-foreground">
          <span className="font-semibold text-ink">How we count:</span> every figure comes from our live database, is refreshed daily and is
          rounded down (“+” means more than shown); open jobs leave out internships and expired or closed postings, a job listed more than once counts once, and each employer counts once.
        </p>
      </WorkforceStatsTracker>
    </AudienceSection>
  )
}

const CAPABILITIES: { lead: string; body: string }[] = [
  {
    lead: 'Matching by level, skills and location.',
    body: 'Every participant is matched to open jobs at their level, scored on their skills, within the distance they will travel. Jobs inside your region can rank first.',
  },
  {
    lead: 'Skills gaps, then learning.',
    body: 'We compare a participant’s skills with the jobs they want, name each gap and the usual way to close it: a course, a certification, or a work sample employers can review.',
  },
  {
    lead: 'Pivot paths.',
    body: 'For people who can’t go back to the same work, we show where their experience carries over, how long the move takes, what it pays, and the open jobs on each path.',
  },
  {
    lead: 'Live job checks.',
    body: 'We keep re-checking that postings are still up, and check again when someone clicks, so participants don’t spend their time on jobs that are gone.',
  },
  {
    lead: 'Employer outreach.',
    body: 'Employers in your region get their own hiring workspace: they post jobs, request layoff support, and meet participants who chose to share their profile.',
  },
  {
    lead: 'Program dashboards and census.',
    body: 'Your staff see participants, readiness, placements and who stayed in the region, with a census you can export as a CSV or pull by API.',
  },
  {
    lead: 'AI retraining.',
    body: 'We measure the AI-skill gap for your participants and close it with a custom program, live or self-paced, or with courses from our library.',
  },
  {
    lead: 'Free to every job seeker.',
    body: 'Participants never pay to use NextChapter.',
  },
]

/** What we do for workforce boards, in plain terms, with a demo and a partner link. */
export function WorkforceCapabilities({ page }: { page: string }) {
  return (
    <AudienceSection id="what-we-do" title="What we do for workforce boards">
      <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <li key={c.lead} className="text-base leading-relaxed">
            <span className="font-semibold">{c.lead}</span> {c.body}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <TrackedLink
          href="/demo/workforce"
          event="workforce_cta_clicked"
          properties={{ page, cta: 'see_demo', location: 'what_we_do' }}
          className="inline-flex h-12 items-center rounded-full border border-ink px-6 text-base font-semibold text-ink hover:bg-muted"
        >
          See a demo workspace
        </TrackedLink>
        <TrackedLink
          href="#join"
          event="workforce_cta_clicked"
          properties={{ page, cta: 'partner_with_us', location: 'what_we_do' }}
          className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-ink hover:bg-muted"
        >
          Partner with us
        </TrackedLink>
      </div>
    </AudienceSection>
  )
}
