'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import type { SkillsGapInsight } from '@/lib/jobs/my-jobs'
import { cn } from '@/lib/utils'

/**
 * The skills the member's saved and applied jobs keep asking for that their
 * profile doesn't show. Rules only (job-skill-gap.ts). `compact` is the one-line
 * nudge on the board; the full card sits in My jobs.
 */
export function SkillsGapInsightCard({ insight, surface, compact = false }: { insight: SkillsGapInsight; surface: 'board' | 'my_jobs'; compact?: boolean }) {
  const top = insight.top[0]
  useEffect(() => {
    posthog.capture('skills_gap_insight_viewed', { topSkill: top.skill, count: top.jobs, jobsWithData: insight.jobsWithData, surface })
  }, [top.skill, top.jobs, insight.jobsWithData, surface])

  const lead = (
    <>
      <span className="font-medium">
        {top.jobs} of your {insight.jobsWithData} saved and applied jobs ask for {top.skill}.
      </span>{' '}
      If you have it, add it to your{' '}
      <Link href="/dashboard/skills-assessments" className="text-primary underline underline-offset-4" onClick={() => posthog.capture('skills_gap_insight_clicked', { action: 'add_skill', topSkill: top.skill, surface })}>
        skills
      </Link>{' '}
      so matches count it. If not,{' '}
      <Link href="/dashboard/learning" className="text-primary underline underline-offset-4" onClick={() => posthog.capture('skills_gap_insight_clicked', { action: 'learn', topSkill: top.skill, surface })}>
        here&apos;s how to close it
      </Link>
      .
    </>
  )
  if (compact) {
    return <p className={cn('rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground')}>{lead}</p>
  }
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Skills your jobs keep asking for</h3>
      <p className="text-sm text-foreground">{lead}</p>
      {insight.top.length > 1 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Other skills your saved and applied jobs ask for">
          {insight.top.slice(1).map((s) => (
            <li key={s.skill} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {s.skill} · {s.jobs} jobs
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
