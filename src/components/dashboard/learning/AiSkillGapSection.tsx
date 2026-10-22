import Link from 'next/link'
import { loadMemberSkillGapByKind } from '@/lib/jobs/skill-gap-data'
import { loadApplicationGapSummary } from '@/lib/applications/skill-snapshot-data'
import { getActiveCourses, toLearningResource } from '@/lib/learning/courses'
import { courseForAiSkill } from '@/lib/learning/ai-course-tags'
import { captureServerEvent } from '@/lib/posthog/server'
import { LearningSection } from '@/components/dashboard/learning/LearningSection'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import { SkillGapViews } from '@/components/dashboard/learning/SkillGapViews'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { AiPaysMoreNote, aiPayNoteFor } from '@/components/dashboard/learning/AiPaysMoreNote'
import { SkillAiUseNote } from '@/components/dashboard/SkillAiUseNote'
import { loadMemberSkillAiUse } from '@/lib/aei/server'
import { buildSkillMatrix } from '@/lib/profile/skill-matrix'
import { prisma } from '@/lib/prisma'

/**
 * The skills the member's best-fit jobs ask for, AI skills marked apart (the 24 items of
 * src/lib/skills/ai-skills.ts, read by the crawler from each posting's full text), with
 * AI skills / Other skills / All buttons. Each AI gap links to the catalog course tagged
 * for it (ai-course-tags.ts). Rules only, no model call: job-skill-gap.ts skillGapByKind.
 */
export async function AiSkillGapSection({
  candidateId,
  completedTitles,
  enrolledTitles,
  fn,
}: {
  candidateId: string
  completedTitles: Set<string>
  enrolledTitles: Set<string>
  /** The member's target (else current) function, for the "AI pays more" note. */
  fn?: string | null
}) {
  const [data, catalog, apps, live, skillProfile] = await Promise.all([
    loadMemberSkillGapByKind(candidateId),
    getActiveCourses(),
    loadApplicationGapSummary(candidateId),
    loadAiMarket(),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true },
    }),
  ])
  // Which of the member's skills AI mostly augments (learn to use AI on them) vs automates
  // (Anthropic Economic Index): a note at the top of this existing section, no new section.
  const aiUse = skillProfile
    ? await loadMemberSkillAiUse(buildSkillMatrix(skillProfile).map((r) => r.label)).catch(() => ({ automated: [], augmented: [] }))
    : { automated: [], augmented: [] }
  if (aiUse.automated.length + aiUse.augmented.length > 0) {
    captureServerEvent(candidateId, 'skill_ai_use_viewed', {
      surface: 'learning_gap',
      automated: aiUse.automated.map((r) => r.skill),
      augmented: aiUse.augmented.map((r) => r.skill),
    })
  }
  const aiUseNode = aiUse.automated.length + aiUse.augmented.length > 0 ? <SkillAiUseNote use={aiUse} /> : null
  // The same gaps from the member's own applications (src/lib/applications), so both views agree.
  const appAsked = new Map((apps?.gaps ?? []).map((g) => [g.term.toLowerCase(), g.applications]))
  // "AI pays more in your field" (live board, ai-market.ts): a note at the top of this existing
  // section (no new section), only when the like-for-like comparison shows a premium.
  const note = aiPayNoteFor(fn, live, catalog)
  if (note) captureServerEvent(candidateId, 'ai_pay_note_viewed', { fn: note.fn, likePct: note.likePct, skills: note.skills.map((s) => s.id) })
  const noteNode = note ? <AiPaysMoreNote note={note} surface="learning" /> : null
  if (!data || data.rows.length === 0) {
    return noteNode || aiUseNode ? (
      <LearningSection id="ai-skills-for-your-search" title="AI skills in your field">
        {noteNode}
        {aiUseNode}
      </LearningSection>
    ) : null
  }

  const rows = data.rows.map((r) => ({ ...r, course: r.ai && !r.have ? courseForAiSkill(r.term, catalog) : null }))
  captureServerEvent(candidateId, 'ai_skill_gap_viewed', {
    employers: data.employersWithSkillData,
    employersAskingAi: data.employersAskingAi,
    aiGaps: rows.filter((r) => r.ai && !r.have).map((r) => r.term),
    otherGaps: rows.filter((r) => !r.ai && !r.have).map((r) => r.term),
    aiHave: rows.filter((r) => r.ai && r.have).map((r) => r.term),
    coursesLinked: rows.filter((r) => r.course).length,
  })

  const n = data.employersWithSkillData
  const items = rows.map((r) => ({
    key: r.term,
    ai: r.ai,
    node: (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{r.term}</h3>
          {r.ai && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">AI skill</span>}
          <span
            className={
              r.have
                ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400'
                : 'rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400'
            }
          >
            {r.have ? 'On your profile' : 'Not on your profile'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {r.employers} of {n} employer{n === 1 ? '' : 's'} with jobs that fit you ask for it.
          {!r.have && appAsked.get(r.term.toLowerCase()) ? ` Also asked for in ${appAsked.get(r.term.toLowerCase())} of the ${apps!.applications} jobs you applied to.` : ''}
          {!r.have && (
            <>
              {' '}
              If you have it,{' '}
              <Link href="/dashboard/skills-assessments" className="text-primary underline underline-offset-4">
                add it to your skills
              </Link>{' '}
              so matches count it.
            </>
          )}
        </p>
        {r.course && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            <LearningResourceCard
              item={{ ...toLearningResource(r.course), rationale: `Covers ${r.term.toLowerCase()}.`, completionCount: 0, alreadyHeld: false } satisfies LearningPlanItem}
              section="ai-skill-gap"
              completed={completedTitles.has(r.course.title)}
              enrolled={enrolledTitles.has(r.course.title)}
              carousel
            />
          </div>
        )}
      </div>
    ),
  }))

  return (
    <LearningSection
      id="ai-skills-for-your-search"
      title="Skills your best-fit jobs ask for"
      description={`${data.employersAskingAi} of the ${n} employer${n === 1 ? '' : 's'} with jobs that fit you ask for a specific AI skill. Gaps first, each AI gap with a course that covers it.`}
    >
      {noteNode}
      {aiUseNode}
      <SkillGapViews items={items} />
    </LearningSection>
  )
}
