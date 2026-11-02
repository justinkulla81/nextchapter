import EngagementBlock from '@/emails/engagement-block'
import type { EngagementLead } from '@/lib/journey/engagement'
import { Button, Card, CardEmail, Headline, Hero, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface WeeklyGapNudgeEmailProps {
  engagement?: EngagementLead | null
  appUrl?: string
  firstName: string | null
  introCopy?: string | null
  weeklyPoints: number
  weeklyPointsTarget: number
  dashboardUrl: string
  unsubscribeUrl: string
}

export default function WeeklyGapNudgeEmail({
  engagement = null,
  appUrl = '',
  firstName,
  introCopy,
  weeklyPoints,
  weeklyPointsTarget,
  dashboardUrl,
  unsubscribeUrl,
}: WeeklyGapNudgeEmailProps) {
  const pointsToGo = Math.max(0, weeklyPointsTarget - weeklyPoints)

  return (
    <CardEmail
      preheader={`${pointsToGo} points from an A this week.`}
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Turn off these weekly nudges</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{firstName ? `${firstName}, you` : 'You'} are close to an A this week</Headline>
        <Hero value={String(pointsToGo)} caption="points from an A this week" />
        {introCopy && <Lead>{introCopy}</Lead>}
        <Lead>
          You&apos;re at <strong>{weeklyPoints} of {weeklyPointsTarget}</strong> points for this week&apos;s Weekly Search Score. The &quot;More Actions
          Available&quot; list on your dashboard has quick options beyond what you committed to, and anything you complete there counts too.
        </Lead>
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          <EngagementBlock lead={engagement} appUrl={appUrl} />
        </div>
        <Button href={dashboardUrl}>See what&apos;s fastest to close the gap</Button>
      </Card>
    </CardEmail>
  )
}
