import Link from 'next/link'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, Section } from '@/components/candidate/ui'
import { CourseLink } from '@/components/dashboard/CourseLink'
import { LEARNING_PROVIDERS } from '@/lib/constants/learning-partners'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'

const providerName = (item: LearningPlanItem) => LEARNING_PROVIDERS[item.provider]?.name ?? String(item.provider)
const meta = (item: LearningPlanItem) => [providerName(item), item.sponsor, item.free ? 'Free' : 'Paid'].filter(Boolean).join(' · ')

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95'
const SECONDARY = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'

// Learn in the redesign: one course up front with the reason, a few more behind it, and what you have finished.
// The full library (AI training tiers, tools, interview skills, guides) is one link away.
export function LearnHome({ featured, more, enrolledTitles, completedCount, allHref }: { featured: LearningPlanItem | null; more: LearningPlanItem[]; enrolledTitles: Set<string>; completedCount: number; allHref: string }) {
  return (
    <>
      <PageHeader title="Skills and courses" intro="The few courses that would do the most for your search. Each one says why." />

      {featured ? (
        <section aria-labelledby="featured" className="space-y-4 rounded-2xl border border-border p-7">
          <Chip tone="warm">{enrolledTitles.has(featured.title) ? 'Finish this one' : featured.rationale ? 'Biggest gap' : 'Good next step'}</Chip>
          <h2 id="featured" className="font-display text-2xl font-semibold text-ink">{featured.title}</h2>
          <p className="max-w-2xl text-base text-ink">
            <span className="font-semibold">Why:</span> {featured.rationale ?? featured.description}
          </p>
          <p className="text-sm text-muted-foreground">{meta(featured)}</p>
          <CourseLink href={featured.url} partnerName={providerName(featured)} title={featured.title} slot="featured" hasReason={!!featured.rationale} className={PRIMARY}>
            {enrolledTitles.has(featured.title) ? 'Keep going' : 'Start the course'}
          </CourseLink>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl border border-border p-7">
          <h2 className="font-display text-2xl font-semibold text-ink">You are up to date.</h2>
          <p className="max-w-2xl text-base text-muted-foreground">Nothing is missing for the roles we are matching you to. When your target changes, new courses appear here.</p>
        </section>
      )}

      {more.length > 0 && (
        <Section id="more" title="Other courses worth your time">
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {more.map((item) => (
              <li key={item.title} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-base font-semibold text-ink">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.rationale ?? item.description}</p>
                  <p className="text-sm text-muted-foreground">{meta(item)}</p>
                </div>
                <CourseLink href={item.url} partnerName={providerName(item)} title={item.title} slot="more" hasReason={!!item.rationale} className={SECONDARY}>
                  See the course
                </CourseLink>
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
    </>
  )
}
