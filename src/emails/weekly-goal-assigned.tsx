import EngagementBlock from '@/emails/engagement-block'
import type { EngagementLead } from '@/lib/journey/engagement'
import type { Grade } from '@/lib/scoring/grade'
import { Body, Button, Card, CardEmail, CardGap, Headline, Hero, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface WeeklyGoalAssignedEmailProps {
  engagement?: EngagementLead | null
  appUrl?: string
  firstName: string | null
  introCopy?: string | null
  lastWeekPoints: number
  lastWeekTarget: number
  hitLastWeekTarget: boolean
  thisWeekTarget: number
  targetDelta: number
  grade: Grade
  gapSummary: string | null
  completedLastWeek: string[]
  thisWeekPlan: string[]
  firstStep?: string | null
  dashboardUrl: string
  marketRealityReportUrl: string
  unsubscribeUrl: string
}

const listStyle: React.CSSProperties = { margin: '0 0 16px', paddingLeft: '20px', fontSize: '16px', lineHeight: '1.6', color: INK }
const subhead: React.CSSProperties = { margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: INK }
const left: React.CSSProperties = { textAlign: 'left' }

const A_GRADE_BENEFITS = [
  'Who to contact, the apply kit and explain-my-gaps on every NC Job Board job',
  'Eligible to submit an Offer Bonus claim if you land a role',
  'Your Executive Dossier becomes shareable with recruiters and hiring managers',
  "You're surfaced to recruiters browsing the candidate database",
]

export default function WeeklyGoalAssignedEmail({
  engagement = null,
  appUrl = '',
  firstName,
  introCopy,
  lastWeekPoints,
  lastWeekTarget,
  hitLastWeekTarget,
  thisWeekTarget,
  targetDelta,
  grade,
  gapSummary,
  completedLastWeek,
  thisWeekPlan,
  firstStep = null,
  dashboardUrl,
  marketRealityReportUrl,
  unsubscribeUrl,
}: WeeklyGoalAssignedEmailProps) {
  const deltaCopy =
    targetDelta > 0
      ? `${targetDelta} more points than last week`
      : targetDelta < 0
        ? `${Math.abs(targetDelta)} fewer points than last week`
        : 'the same target as last week'

  return (
    <CardEmail
      preheader={`This week's target: ${thisWeekTarget} points.`}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Turn off these weekly emails
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {firstName ? `Hi ${firstName} — ` : ''}your new week is set.
        </Headline>
        {introCopy && <Lead>{introCopy}</Lead>}
        <Hero value={String(thisWeekTarget)} caption="points target this week" />
        <div style={left}>
          <Body>
            Last week: {lastWeekPoints} of {lastWeekTarget} points —{' '}
            {hitLastWeekTarget ? 'you hit the Weekly Sprint Target' : "you didn't hit the Weekly Sprint Target"}.
          </Body>
          <Body>
            This week&apos;s target: <strong>{thisWeekTarget} points</strong> ({deltaCopy}).
          </Body>
          <EngagementBlock lead={engagement} appUrl={appUrl} />
        </div>
      </Card>

      {completedLastWeek.length > 0 && (
        <>
          <CardGap />
          <Card>
            <p style={subhead}>Look what you got done last week</p>
            <ul style={{ ...listStyle, margin: 0 }}>
              {completedLastWeek.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <CardGap />
      <Card>
        <p style={subhead}>Your plan this week:</p>
        {thisWeekPlan.length > 0 ? (
          <ul style={{ ...listStyle, margin: firstStep ? '0 0 16px' : 0 }}>
            {thisWeekPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <Body>Already picked for you and ready on your dashboard — no setup needed, just get started.</Body>
        )}

        {firstStep && (
          <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.6', color: INK }}>
            <strong>Start with:</strong> {firstStep}
          </p>
        )}
      </Card>

      <CardGap />
      <Card center pad="28px 32px 36px">
        <div style={left}>
          {grade === 'A' ? (
            <>
              <p style={subhead}>Your Market Reality Assessment is an A. That unlocks:</p>
              <ul style={listStyle}>
                {A_GRADE_BENEFITS.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </>
          ) : (
            gapSummary && (
              <Body>
                <strong>Market Reality Assessment: {grade}.</strong> {gapSummary}
              </Body>
            )
          )}

          <p style={{ margin: '0 0 28px', fontSize: '16px' }}>
            <a href={marketRealityReportUrl} style={{ color: '#1d4e89', fontWeight: 600, textDecoration: 'none' }}>
              See your full Market Reality Report
            </a>
          </p>
        </div>

        <Button href={dashboardUrl}>Go to my dashboard</Button>
      </Card>
    </CardEmail>
  )
}
