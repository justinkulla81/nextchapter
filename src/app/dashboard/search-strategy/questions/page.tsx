import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { spineGaps } from '@/lib/personalization/spine'
import { queueQuickQuestions } from '@/lib/search-strategy/quick-questions'
import { QuickQuestionFlow } from '@/components/dashboard/QuickQuestionFlow'

export const metadata: Metadata = { title: 'A few quick questions' }

const BACK = '/dashboard/search-strategy'

export default async function QuickQuestionsPage() {
  const profile = await getDashboardData()
  const gaps = spineGaps(effectiveJourney(profile), effectiveStage(profile), profile as unknown as Record<string, unknown>)
  const questions = queueQuickQuestions(gaps)

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-serif text-3xl leading-tight font-semibold text-navy">You have answered everything we need right now.</h1>
        <p className="text-base text-muted-foreground">More questions appear here as your search moves on. You can change any answer on your strategy page.</p>
        <Link href={BACK} className="inline-flex h-11 items-center rounded-full nc-action px-7 text-base font-semibold">
          Back to your strategy
        </Link>
      </div>
    )
  }
  return <QuickQuestionFlow questions={questions} backHref={BACK} />
}
