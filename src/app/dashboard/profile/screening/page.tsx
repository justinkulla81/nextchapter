import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { RedFlagsQuestionsForm } from '@/components/dashboard/RedFlagsQuestionsForm'
import { WorkAuthorizationConfirmForm } from '@/components/dashboard/WorkAuthorizationConfirmForm'
import { EeocSelfIdForm } from '@/components/dashboard/EeocSelfIdForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'Screening Questions' }

const RED_FLAGS_POINTS = estimateActionEffort({ actionType: 'RED_FLAGS_CONFIRMED' }).points

// One of three sub-pages under the My Profile hub (see
// /dashboard/profile/page.tsx). Shared with your coach and recruiter/
// employer contacts — helps them match you to roles you're actually
// eligible for, and flag issues before an offer, not after. Section order
// puts the most sensitive item (demographic self-ID — protected-class
// data) in the middle, flanked by the two less-invasive sections.
export default async function ScreeningPage() {
  const profile = await getDashboardData()
  const redFlagsAnswered = !!profile.redFlagsBonusAt

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:text-foreground">
          ← My Profile
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Screening Questions</h1>
        <p className="mt-1 text-muted-foreground">
          Shared with your coach and recruiter/employer contacts — helps them match you to roles
          you&apos;re actually eligible for, and flag issues before an offer, not after.
        </p>
        <PageHeaderBoxes pageKey="profile" candidateId={profile.id} />
      </div>

      <Card id="screening-questions" className="scroll-mt-4">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Screening questions
            </CardTitle>
            {!redFlagsAnswered && (
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                +{RED_FLAGS_POINTS} pts
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {redFlagsAnswered ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden>
                ✓
              </span>
              Answered
            </p>
          ) : (
            <RedFlagsQuestionsForm currentJobStatus={profile.currentJobStatus} />
          )}
        </CardContent>
      </Card>

      <Card id="demographics" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Optional demographic self identification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EeocSelfIdForm
            eeocGenderIdentity={profile.eeocGenderIdentity}
            eeocRaceEthnicity={profile.eeocRaceEthnicity}
            eeocDisabilityStatus={profile.eeocDisabilityStatus}
            eeocVeteranStatus={profile.eeocVeteranStatus}
          />
        </CardContent>
      </Card>

      <Card id="work-authorization" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Work authorization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkAuthorizationConfirmForm
            workAuthorization={profile.workAuthorization}
            visaStatus={profile.visaStatus}
            confirmedAt={profile.workAuthConfirmedAt}
          />
        </CardContent>
      </Card>
    </div>
  )
}
