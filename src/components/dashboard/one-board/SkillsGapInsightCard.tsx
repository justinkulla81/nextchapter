'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import type { SkillsGapInsight } from '@/lib/jobs/my-jobs'
import { cn } from '@/lib/utils'
import { defaultCourseForAiSkill } from '@/lib/learning/ai-course-tags'
import { skillInAiView, type AiView } from '@/lib/jobs/ai-view'
import { AiViewToggle } from '@/components/dashboard/AiViewToggle'

/** Chips after the lead skill. */
const MORE_SKILLS = 4

/**
 * The skills the member's saved and applied jobs keep asking for that their
 * profile doesn't show. Rules only (job-skill-gap.ts). `compact` is the one-line
 * nudge on the board, which follows the board's AI / Non-AI / All choice (`aiView`);
 * the full card sits in My jobs with its own AI skills / Other skills / All buttons.
 */
export function SkillsGapInsightCard({
  insight,
  surface,
  compact = false,
  aiView,
}: {
  insight: SkillsGapInsight
  surface: 'board' | 'my_jobs'
  compact?: boolean
  /** The board's choice (compact); omitted: All, with the card's own buttons. */
  aiView?: AiView
}) {
  const [ownView, setOwnView] = useState<AiView>('all')
  const view = aiView ?? ownView
  const shown = insight.top.filter((s) => skillInAiView(view, s.skill))
  const top = shown[0] as SkillsGapInsight['top'][number] | undefined
  // An AI skill gap links straight to the course that covers it (ai-course-tags.ts).
  const course = top ? defaultCourseForAiSkill(top.skill) : null
  useEffect(() => {
    if (!top) return
    posthog.capture('skills_gap_insight_viewed', { topSkill: top.skill, count: top.jobs, jobsWithData: insight.jobsWithData, surface, aiView: view })
  }, [top, insight.jobsWithData, surface, view])
  const toggle =
    aiView === undefined && insight.top.some((s) => s.ai) ? (
      <AiViewToggle
        surface={`skills_gap_${surface}`}
        kind="skills"
        current={ownView}
        onChange={setOwnView}
        counts={{ ai: insight.top.filter((s) => s.ai).length, other: insight.top.filter((s) => !s.ai).length, all: insight.top.length }}
      />
    ) : null

  if (!top) {
    if (compact) return null
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Skills your jobs keep asking for</h3>
          {toggle}
        </div>
        <p className="text-sm text-muted-foreground">
          {view === 'ai'
            ? 'Your saved and applied jobs ask for no AI skill you don’t already show.'
            : 'Your saved and applied jobs ask for no other skill you don’t already show.'}
        </p>
      </div>
    )
  }

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
      {course ? (
        <>
          start with{' '}
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
            onClick={() => posthog.capture('skills_gap_insight_clicked', { action: 'ai_course', topSkill: top.skill, aiSkill: course.id, courseUrl: course.url, surface })}
          >
            {course.title}
          </a>
          .
        </>
      ) : (
        <>
          <Link href="/dashboard/learning" className="text-primary underline underline-offset-4" onClick={() => posthog.capture('skills_gap_insight_clicked', { action: 'learn', topSkill: top.skill, surface })}>
            here&apos;s how to close it
          </Link>
          .
        </>
      )}
    </>
  )
  if (compact) {
    return <p className={cn('rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground')}>{lead}</p>
  }
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Skills your jobs keep asking for</h3>
        {toggle}
      </div>
      <p className="text-sm text-foreground">{lead}</p>
      {shown.length > 1 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Other skills your saved and applied jobs ask for">
          {shown.slice(1, 1 + MORE_SKILLS).map((s) => (
            <li key={s.skill} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {s.skill} · {s.jobs} jobs
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
