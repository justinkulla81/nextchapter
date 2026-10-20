import type { ReactNode } from 'react'
import type { MyJobsView } from '@/lib/jobs/my-jobs-data'
import { followUpPrompt, nextAction, sortRows, whenLine, FIND_JOBS_HREF } from '@/lib/jobs/my-jobs-list'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { MyJobsFunnel } from '@/components/dashboard/one-board/MyJobsPanel'
import { MyJobsList, type MyJobRow } from '@/components/dashboard/find/MyJobsList'
import { ApplyPrompts } from '@/components/dashboard/one-board/ApplyPrompts'
import { MyJobsViewed } from '@/components/dashboard/one-board/MyJobsViewed'
import { SkillsGapInsightCard } from '@/components/dashboard/one-board/SkillsGapInsightCard'

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * My jobs, redesigned (docs/candidate-redesign.md, mockup MyJobs): saved, applied, interviewing and offers
 * as one list with a status chip and one next action each, one follow-up prompt when a reply is overdue, and
 * the "did you apply?" question when a job was opened and not logged. The funnel, skills insight, Gmail
 * stats and the full application tracker are one click away under "Show more" (the page renders those).
 * Data is loadMyJobs, unchanged.
 */
export function MyJobsRedesign({ view, now = new Date() }: { view: MyJobsView; now?: Date }) {
  const rows: MyJobRow[] = view.items.map((i) => {
    const pageHref = i.ref?.source === 'job_board' ? `/dashboard/jobs/${i.ref.sourceId}?src=my_jobs` : null
    return {
      key: i.key,
      title: i.title,
      companyName: i.companyName,
      status: i.status,
      date: i.date,
      when: whenLine(i.status, i.date, now),
      action: nextAction({ status: i.status, date: i.date, openHref: pageHref ?? i.url, listingClosed: !!i.listing }, now),
      openHref: pageHref ?? i.url,
      fromEmail: i.origin === 'email',
      jobPostingId: i.jobPostingId,
      ref: i.ref,
      watched: !!i.companyName && view.watchedCompanies.has(normalizeOrgName(i.companyName)),
      closed: i.listing && i.ref ? { sentence: i.listing.sentence, jobId: i.ref.sourceId } : null,
      pageHref,
    }
  })
  const sorted = sortRows(rows)
  const counts = { saved: 0, applied: 0, interviewing: 0, offer: 0, closed: 0 }
  for (const r of rows) counts[r.status]++
  const followUp = followUpPrompt(sorted, now)

  const empty: ReactNode = (
    <div className="space-y-2 rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="text-base font-semibold text-ink">Nothing saved or applied yet</p>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">Save a job you like, or tell us when you apply. Applications in your connected Gmail show up here on their own.</p>
      <ActionLink href={FIND_JOBS_HREF} event="my_jobs_empty_find_jobs_clicked" props={{ source: 'my_jobs' }}>
        Find a job
      </ActionLink>
    </div>
  )

  return (
    <section id="my-jobs" aria-label="My jobs" className="scroll-mt-4 space-y-6">
      <MyJobsViewed saved={counts.saved} applied={counts.applied} interviewing={counts.interviewing} offer={counts.offer} prompts={view.prompts.length} fromEmail={rows.filter((r) => r.fromEmail).length} />

      <ApplyPrompts prompts={view.prompts.map((p) => ({ trackedJobId: p.trackedJobId, title: p.title, companyName: p.companyName, clickedOn: fmt(p.clickedAt) }))} />

      {followUp && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted/60 px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-semibold text-ink">Time to follow up</p>
            <p className="text-sm text-ink">{followUp.text}</p>
          </div>
          <ActionLink href={followUp.href} event="my_jobs_follow_up_clicked" props={{ jobKey: followUp.key, days: followUp.days }}>
            Write a follow-up
          </ActionLink>
        </div>
      )}

      <MyJobsList rows={sorted} empty={empty} />

      {rows.length > 0 && (
        <ShowMore event="my_jobs_more_opened" properties={{ section: 'funnel_and_skills' }} label="Your search funnel and what your saved jobs ask for">
          <MyJobsFunnel funnel={view.funnel} />
          {view.insight && <SkillsGapInsightCard insight={view.insight} surface="my_jobs" />}
        </ShowMore>
      )}
    </section>
  )
}
