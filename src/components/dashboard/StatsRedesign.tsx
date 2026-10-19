import { Suspense } from 'react'
import { after } from 'next/server'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeWeeklyEngines } from '@/lib/scoring/dossier-competencies'
import { getCandidateWeekNumber, getMondayOfWeek } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'
import { barHeights, bestWeekSentence, weeklyEffort } from '@/lib/redesign/effort-history'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { SeeAllLink } from '@/components/candidate/SeeAllLink'
import { Section } from '@/components/candidate/ui'
import { UnlocksSection } from '@/components/dashboard/home/UnlocksSection'
import { HomeModuleSkeleton } from '@/components/dashboard/home/HomeModuleSkeleton'

function Tiles({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <dl aria-label={label} className="grid grid-cols-3 gap-3 text-center">
      {items.map(([v, l]) => (
        <div key={l} className="rounded-xl bg-muted/60 px-2 py-3">
          <dd className="text-2xl font-semibold text-ink tabular-nums">{v}</dd>
          <dt className="text-xs text-muted-foreground">{l}</dt>
        </div>
      ))}
    </dl>
  )
}

/**
 * Effort and results: what the member has put in and what has come back, the Candidate+ step that effort
 * is building toward, and the minutes of work by week. No badges and no leaderboards. The full page is one link away.
 */
export async function StatsRedesign({ profile }: { profile: CandidateProfile }) {
  const weekStartDate = getMondayOfWeek(new Date())
  const weekNumber = await getCandidateWeekNumber(profile.id, weekStartDate)
  const [engines, applications, interviews, offers, conversations, referencesDone, sprints] = await Promise.all([
    computeWeeklyEngines(profile.id, weekNumber, profile.privacyTier, profile.confidentialSearchMode),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, interviewLandedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, offerReceivedAt: { not: null } } }),
    prisma.outreachLog.count({ where: { candidateId: profile.id } }),
    prisma.reference.count({ where: { candidateId: profile.id, status: 'COMPLETED' } }),
    prisma.weeklySprint.findMany({ where: { candidateId: profile.id }, orderBy: { weekStartDate: 'desc' }, take: 12, select: { weekStartDate: true, committedActions: true } }),
  ])
  const weeks = weeklyEffort(sprints)
  const heights = barHeights(weeks)
  const totalMinutes = weeks.reduce((sum, w) => sum + w.minutes, 0)
  const best = bestWeekSentence(weeks)
  const empty = totalMinutes === 0 && applications === 0 && conversations === 0

  after(() => captureServerEvent(profile.id, 'effort_results_viewed', { minutes: totalMinutes, applications, interviews, offers, conversations, weeksShown: weeks.length }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Effort and results"
        intro="What you have put in, and what has come back. Effort is yours to control. Results follow, but not on a schedule."
        action={
          <ActionLink variant="primary" href="/dashboard" event="effort_results_next_action_clicked" props={{ weeklyMinutes: engines.weeklyPoints, target: engines.weeklyPointsTarget }}>
            Do your next action
          </ActionLink>
        }
      />

      {empty ? (
        <section className="space-y-2 rounded-2xl border border-border p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Your first day</h2>
          <p className="max-w-xl text-base text-ink">Nothing to total yet, and that is normal. Your first action on Your week starts this page, and every minute of real work counts: 1 point is 1 minute.</p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <section aria-labelledby="effort" className="space-y-3 rounded-2xl border border-border p-6">
            <h2 id="effort" className="font-display text-xl font-semibold text-ink">Your effort</h2>
            <Tiles label="Your effort" items={[[`${totalMinutes.toLocaleString()}`, `minutes in ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`], [`${applications}`, 'applications'], [`${conversations}`, 'conversations']]} />
            <p className="text-sm text-muted-foreground">
              This week: {engines.weeklyPoints} of {engines.weeklyPointsTarget} minutes toward your goal.
            </p>
          </section>
          <section aria-labelledby="results" className="space-y-3 rounded-2xl border border-border p-6">
            <h2 id="results" className="font-display text-xl font-semibold text-ink">What came back</h2>
            <Tiles label="What came back" items={[[`${interviews}`, interviews === 1 ? 'interview' : 'interviews'], [`${referencesDone}`, referencesDone === 1 ? 'reference done' : 'references done'], [`${offers}`, offers === 1 ? 'offer' : 'offers yet']]} />
            <p className="text-sm text-muted-foreground">
              {interviews > 0 ? 'Interviews follow effort, so keep the weeks coming.' : 'Interviews usually follow a few weeks of steady effort. Yours are on their way.'}
            </p>
          </section>
        </div>
      )}

      <Suspense fallback={<HomeModuleSkeleton title="Unlocks" rows={2} />}>
        <UnlocksSection profile={profile} redesign />
      </Suspense>

      {weeks.length > 0 && totalMinutes > 0 && (
        <Section id="by-week" title="Minutes of real work, by week">
          <div className="flex items-end gap-2 rounded-2xl border border-border p-4" role="img" aria-label={`Minutes of work per week over the last ${weeks.length} weeks`}>
            {weeks.map((w, i) => (
              <div key={w.weekStart.toISOString()} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className={i === weeks.length - 1 ? 'w-full rounded-t bg-ink' : 'w-full rounded-t bg-ink/30'} style={{ height: `${Math.round((heights[i] / 100) * 112)}px` }} />
                <span className="text-[10px] text-muted-foreground">{w.weekStart.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">1 point = 1 minute. {best}</p>
        </Section>
      )}

      <SeeAllLink href="/dashboard/stats?view=all">See every stat, report and action</SeeAllLink>
    </div>
  )
}
