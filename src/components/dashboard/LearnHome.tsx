import Link from 'next/link'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, Section } from '@/components/candidate/ui'
import { CourseLink } from '@/components/dashboard/CourseLink'
import { LEARNING_PROVIDERS } from '@/lib/constants/learning-partners'
import { LearnWhyFirst } from '@/components/dashboard/learning/LearnWhyFirst'
import type { LearnWhy } from '@/lib/redesign/learn-exposure-why'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import { AddToPlanButton, PlanRow, type PlanEntryView } from '@/components/dashboard/learning/PlanControls'
import { planOrder } from '@/lib/learning/plan'

const providerName = (item: LearningPlanItem) => LEARNING_PROVIDERS[item.provider]?.name ?? String(item.provider)
const meta = (item: LearningPlanItem) => [providerName(item), item.sponsor, item.free ? 'Free' : 'Paid'].filter(Boolean).join(' · ')

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95'

// Learn in the redesign: one course up front with the reason, a few more behind it, and what you have finished.
// The full library (AI training tiers, tools, interview skills, guides) is one link away.
export function LearnHome({ featured, more, enrolledTitles, completedCount, allHref, why, aiExposureBand, after, plan = [], countedBy = [] }: { countedBy?: string[]; plan?: PlanEntryView[]; after?: React.ReactNode; featured: LearningPlanItem | null; more: LearningPlanItem[]; enrolledTitles: Set<string>; completedCount: number; allHref: string; why?: LearnWhy | null; aiExposureBand?: string | null }) {
  const inPlan = new Set(plan.map((p) => p.title))
  const mine = planOrder(plan)
  const started = plan.filter((p) => p.status === 'STARTED').length
  return (
    <>
      <PageHeader title="Skills and courses" />

      {featured ? (
        <section aria-labelledby="featured" className="space-y-3 rounded-2xl border border-border p-5">
          <Chip tone="warm">{enrolledTitles.has(featured.title) ? 'Finish this one' : featured.rationale ? 'Biggest gap' : 'Good next step'}</Chip>
          <h2 id="featured" className="font-display text-2xl font-semibold text-ink">{featured.title}</h2>
          <p className="max-w-2xl text-base text-ink">
            <span className="font-semibold">Why:</span> {featured.rationale ?? featured.description}
          </p>
          <p className="text-sm text-muted-foreground">{meta(featured)}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <CourseLink href={featured.url} partnerName={providerName(featured)} title={featured.title} slot="featured" hasReason={!!featured.rationale} aiExposureBand={aiExposureBand} className={PRIMARY}>
              {enrolledTitles.has(featured.title) ? 'Keep going' : 'Start the course'}
            </CourseLink>
            <AddToPlanButton title={featured.title} provider={providerName(featured)} url={featured.url} slot="featured" inPlan={inPlan.has(featured.title)} />
            {why && (
              <details className="group min-w-0 text-sm">
                <summary className="cursor-pointer list-none font-medium text-brand underline underline-offset-4 marker:content-none">
                  <span className="group-open:hidden">Why this first: AI at work in your role</span>
                  <span className="hidden group-open:inline">Hide why this first</span>
                </summary>
                <div className="mt-3">
                  <LearnWhyFirst why={why} />
                </div>
              </details>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl border border-border p-7">
          <h2 className="font-display text-2xl font-semibold text-ink">You are up to date.</h2>
          <p className="max-w-2xl text-base text-muted-foreground">Nothing is missing for the roles we are matching you to. When your target changes, new courses appear here.</p>
        </section>
      )}

      {mine.length > 0 && (
        <Section id="plan" title="Your plan">
          <p className="text-sm text-muted-foreground">
            {mine.length} {mine.length === 1 ? 'course' : 'courses'}
            {started > 0 ? `, ${started} started` : ''}. “Done” here is your word; courses you finish are added to your profile when we see the completion email.
          </p>
          {countedBy.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {countedBy.join(' and ')} counts the skills in plans, without names, to see what training to offer. A count under five people is never shown.
            </p>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {mine.map((p) => (
              <PlanRow key={p.id} entry={p} />
            ))}
          </ul>
        </Section>
      )}

      {more.length > 0 && (
        <Section id="more" title="Other courses worth your time">
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {more.map((item) => (
              <li key={item.title} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-base font-semibold text-ink">
                    <CourseLink href={item.url} partnerName={providerName(item)} title={item.title} slot="more" hasReason={!!item.rationale} className="underline-offset-4 hover:underline">
                      {item.title}
                    </CourseLink>
                  </p>
                  <p className="text-sm text-muted-foreground">{item.rationale ?? item.description}</p>
                  <p className="text-sm text-muted-foreground">{meta(item)}</p>
                </div>
                <AddToPlanButton title={item.title} provider={providerName(item)} url={item.url} slot="more" inPlan={inPlan.has(item.title)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="space-y-2">
        {completedCount > 0 && (
          <p className="text-sm text-muted-foreground">You have finished {completedCount} {completedCount === 1 ? 'course' : 'courses'}. Each one goes on your profile and into your dossier.</p>
        )}
        <Link href={allHref} className="inline-block text-sm font-medium text-brand underline underline-offset-4">See every course, tool and guide</Link>
      </div>
      {after}
    </>
  )
}
