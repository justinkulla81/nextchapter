import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { AssessmentForm } from '@/components/onboarding/AssessmentForm'
import { KnownForForm } from '@/components/dashboard/KnownForForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENT_ASSESSMENT_ROTATION_GROUP } from '@/lib/constants/onboarding'

const RETAKE_COOLDOWN_DAYS = 7

export default async function RetakeAssessmentPage() {
  const profile = await getDashboardData()

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
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">How I Work Best</h1>
            <p className="text-muted-foreground">
              You can retake your How I Work Best assessment once a week — next retake available in{' '}
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.
            </p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How I Work Best</h1>
        <p className="mt-2 text-muted-foreground">
          How you work can shift as your search progresses — this replaces your How I Work Best
          profile with a fresh read. No wrong answers.
        </p>
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
