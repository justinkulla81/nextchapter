import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { AssessmentForm } from '@/components/onboarding/AssessmentForm'
import { KnownForForm } from '@/components/dashboard/KnownForForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CURRENT_ASSESSMENT_ROTATION_GROUP } from '@/lib/constants/onboarding'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'

export const metadata: Metadata = { title: 'How I Work Best' }


const RETAKE_COOLDOWN_DAYS = 7

export default async function RetakeAssessmentPage() {
  const profile = await getDashboardProfile()
  const redesign = isRedesignOn(profile.email)

  const latestResponse = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

  if (latestResponse) {
    const now = new Date()
    const daysSince = (now.getTime() - latestResponse.completedAt.getTime()) / (24 * 60 * 60 * 1000)
    if (daysSince < RETAKE_COOLDOWN_DAYS) {
      const daysRemaining = Math.ceil(RETAKE_COOLDOWN_DAYS - daysSince)
      if (redesign) {
        return (
          <div className="space-y-8">
            <PageHeader
              title="How I work best"
              intro={`You can retake this once a week, so your next retake opens in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Your last answers are already shaping your matches.`}
              action={<ActionLink href="/dashboard/skills-assessments" event="assessment_list_opened" props={{ from: 'retake_cooldown' }}>Back to how I work</ActionLink>}
            />
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl font-semibold text-ink">How you come across</CardTitle>
              </CardHeader>
              <CardContent>
                <KnownForForm knownFor={profile.knownFor} />
              </CardContent>
            </Card>
          </div>
        )
      }
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">How I Work Best</h1>
            <p className="text-muted-foreground">
              You can retake your How I Work Best assessment once a week — next retake available in{' '}
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.
            </p>
            <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/skills-assessments" />} size="sm">
              Back to Assessments
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                How you come across
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KnownForForm knownFor={profile.knownFor} />
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  const [blocks, likertItems] = await Promise.all([
    prisma.quadBlock.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
      orderBy: { blockNumber: 'asc' },
      include: { statements: true },
    }),
    prisma.likertItem.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
    }),
  ])

  if (redesign) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="How I work best"
          intro="How you work shifts as your search moves. A fresh read keeps your matches and your advice fitting you. There are no wrong answers."
        />
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-semibold text-ink">How you come across</CardTitle>
          </CardHeader>
          <CardContent>
            <KnownForForm knownFor={profile.knownFor} />
          </CardContent>
        </Card>
        <AssessmentForm blocks={blocks} likertItems={likertItems} />
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/skills-assessments" className="font-medium text-brand underline underline-offset-4">Back to how I work</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How I Work Best</h1>
        <p className="mt-2 text-muted-foreground">
          How you work can shift as your search progresses — this replaces your How I Work Best
          profile with a fresh read that keeps your job matches personalized. No wrong answers.
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/dashboard/skills-assessments" />}
          size="sm"
          className="mt-3"
        >
          Back to Assessments
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            How you come across
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KnownForForm knownFor={profile.knownFor} />
        </CardContent>
      </Card>
      <AssessmentForm blocks={blocks} likertItems={likertItems} />
    </div>
  )
}
