import EngagementBlock from '@/emails/engagement-block'
import type { EngagementLead } from '@/lib/journey/engagement'
import { Body, Button, Card, CardEmail, HandNote, Headline, Masthead, MUTED, PointsBox, Signoff, Squiggle } from '@/lib/email/card-layout'

interface WeeklyGapNudgeEmailProps {
  engagement?: EngagementLead | null
  appUrl?: string
  firstName: string | null
  introCopy?: string | null
  weeklyPoints: number
  weeklyPointsTarget: number
  dashboardUrl: string
  unsubscribeUrl: string
  /** The handwritten aside under the points box. Left out when null. */
  marginNote?: { src: string | null; text: string } | null
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
  marginNote = null,
}: WeeklyGapNudgeEmailProps) {
  const pointsToGo = Math.max(0, weeklyPointsTarget - weeklyPoints)

  return (
    <CardEmail
      preheader={`${pointsToGo} points from an A this week.`}
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Turn off these weekly nudges</a>}
    >
      <Card pad="28px 32px 36px">
        <Masthead right="Weekly nudge" />
        <Headline>{firstName ? `${firstName}, you` : 'You'} are close to an A this week</Headline>
        <Squiggle />
        <PointsBox value={String(pointsToGo)} caption="points from an A this week" />
        {marginNote && <HandNote src={marginNote.src} text={marginNote.text} />}
        {introCopy && <Body>{introCopy}</Body>}
        <Body>
          You&apos;re at <strong>{weeklyPoints} of {weeklyPointsTarget}</strong> points for this week&apos;s Weekly Search Score. The &quot;More Actions
          Available&quot; list on your dashboard has quick options beyond what you committed to, and anything you complete there counts too.
        </Body>
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          <EngagementBlock lead={engagement} appUrl={appUrl} />
        </div>
        <Button href={dashboardUrl}>See what&apos;s fastest to close the gap</Button>
        <Signoff />
      </Card>
    </CardEmail>
  )
}
