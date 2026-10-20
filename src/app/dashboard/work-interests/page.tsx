import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { WorkInterestsForm } from '@/components/dashboard/WorkInterestsForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchInterestQuestions } from '@/lib/onet/interest-profiler'
import {
  INTEREST_AREA_BLURBS,
  INTEREST_AREA_LABELS,
  INTEREST_AREA_ORDER,
  type InterestAnswer,
  type InterestArea,
  type InterestScores,
  type InterestQuestion,
} from '@/lib/work-interests/areas'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'

export const metadata: Metadata = { title: 'Work Interests' }

export default async function WorkInterestsPage() {
  const profile = await getDashboardProfile()
  const [response, questions] = await Promise.all([
    prisma.workInterestsResponse.findUnique({ where: { candidateId: profile.id } }),
    fetchInterestQuestions().catch((): InterestQuestion[] | null => null),
  ])

  const initialAnswers: Record<number, number> = {}
  for (const a of (response?.answers ?? []) as unknown as InterestAnswer[]) initialAnswers[a.index] = a.answer
  const scores = response?.scores as unknown as InterestScores | undefined
  const topAreas = (response?.topAreas ?? []) as InterestArea[]

  if (isRedesignOn(profile.email)) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Work interests"
          intro="What kind of work energizes you? Sixty quick likes and dislikes, about 10 minutes. It finds roles you would enjoy and courses worth your time."
        />
        {scores && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl font-semibold text-ink">
                Your interest profile: {topAreas.map((a) => INTEREST_AREA_LABELS[a]).join(' · ')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {INTEREST_AREA_ORDER.map((area) => (
                <div key={area} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ink">{INTEREST_AREA_LABELS[area]}</span>
                    <span className="tabular-nums text-muted-foreground">{scores[area]} out of 50</span>
                  </div>
                  <div className="h-2 rounded-full bg-border" role="presentation">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${(scores[area] / 50) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{INTEREST_AREA_BLURBS[area]}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-semibold text-ink">{response ? 'Retake the profiler' : 'How much would you like each activity?'}</CardTitle>
          </CardHeader>
          <CardContent>
            {questions ? (
              <WorkInterestsForm questions={questions} initialAnswers={initialAnswers} />
            ) : (
              <p className="text-sm text-muted-foreground">We could not load the questions just now. Refresh in a minute, and tell us from the help button if it keeps happening.</p>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Questions and scoring come from the O*NET Interest Profiler.{' '}
          <Link href="/dashboard/skills-assessments" className="font-medium text-brand underline underline-offset-4">Back to how I work</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/skills-assessments" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Skills & Behavioral Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Work Interests</h1>
        <p className="mt-1 text-muted-foreground">
          What kind of work actually energizes you, using the O*NET Interest Profiler and the Holland
          RIASEC framework. Answer 60 quick likes and dislikes — it takes about 10 minutes. This feeds
          your Job Recommendations and Learning recommendations.
        </p>
      </div>

      {scores && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your interest profile: {topAreas.map((a) => INTEREST_AREA_LABELS[a]).join(' · ')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {INTEREST_AREA_ORDER.map((area) => (
              <div key={area} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{INTEREST_AREA_LABELS[area]}</span>
                  <span className="tabular-nums text-muted-foreground">{scores[area]} / 50</span>
                </div>
                <div className="h-2 rounded-full bg-light-gray" role="presentation">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(scores[area] / 50) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{INTEREST_AREA_BLURBS[area]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {response ? 'Retake the profiler' : 'How much would you like each activity?'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions ? (
            <WorkInterestsForm questions={questions} initialAnswers={initialAnswers} />
          ) : (
            <p className="text-sm text-muted-foreground">
              We couldn’t load the O*NET questions right now. Refresh the page in a minute — if it keeps
              failing, let us know.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
