import { Body, Button, Card, CardEmail, CardGap, HandNote, Headline, INK, Masthead, MUTED, PointsBox, Signoff, Squiggle } from '@/lib/email/card-layout'

interface WeeklyRecap {
  pointsEarned: number
  pointsTarget: number
  completedTexts: string[]
}

interface MidweekCheckinEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  introCopy: string | null
  isReset: boolean
  resetTask?: string | null
  bullets: string[] | null
  weeklyRecap: WeeklyRecap | null
  gap?: { weeklyPoints: number; weeklyPointsTarget: number; pointsToGo: number } | null
  /** The handwritten aside under the points box. Left out when null. */
  marginNote?: { src: string | null; text: string } | null
  dashboardUrl?: string
  appUrl: string
  unsubscribeUrl: string
}

const taskBox: React.CSSProperties = {
  margin: '0 0 28px',
  padding: '16px 18px',
  borderRadius: '16px',
  backgroundColor: '#e8f0f8',
  fontSize: '17px',
  lineHeight: '1.5',
  fontWeight: 600,
  color: INK,
}

const bulletList: React.CSSProperties = { margin: '0 0 28px', paddingLeft: '20px', fontSize: '17px', lineHeight: '1.6', color: INK }
const recapList: React.CSSProperties = { margin: '8px 0 0', paddingLeft: '18px', fontSize: '15px', lineHeight: '1.6', color: MUTED }

export default function MidweekCheckinEmail({
  firstName,
  victoriaName,
  introCopy,
  isReset,
  resetTask,
  bullets,
  weeklyRecap,
  gap = null,
  marginNote = null,
  dashboardUrl,
  appUrl,
  unsubscribeUrl,
}: MidweekCheckinEmailProps) {
  return (
    <CardEmail
      preheader={gap ? `${gap.pointsToGo} points to go to lock in an A this week.` : 'Your midweek check-in.'}
      audience="candidate"
      footer={
        <>
          Don&apos;t want daily emails?{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Turn them off
          </a>
          .
        </>
      }
    >
      <Card pad="28px 32px 36px">
        <Masthead right="Midweek check-in" />
        <Headline>Hi {firstName || 'there'}, {victoriaName} here.</Headline>
        <Squiggle />
        {gap && <PointsBox value={`${gap.weeklyPoints} of ${gap.weeklyPointsTarget}`} caption={`points toward an A this week, ${gap.pointsToGo} to go`} />}
        {marginNote && <HandNote src={marginNote.src} text={marginNote.text} />}

        {introCopy && <Body>{introCopy}</Body>}

      {isReset ? (
        <>
          <Body>
            I noticed you haven&apos;t checked in for a few days. A job search is hard, and it only
            works with steady effort — but you don&apos;t have to do it alone. We&apos;re here to help.
            You just need to get started.
          </Body>
          <Body>{resetTask ? 'Today, just do this:' : 'Today, pick one small thing and do it.'}</Body>
          {resetTask && (
            <div style={{ textAlign: 'left' }}>
              <p style={taskBox}>{resetTask}</p>
            </div>
          )}
          <Body>Five minutes, then you&apos;re back in motion. I&apos;ll be here.</Body>
        </>
      ) : bullets ? (
        <div style={{ textAlign: 'left' }}>
          <ul style={bulletList}>
            {bullets.map((bullet, i) => (
              <li key={i} style={{ marginTop: '8px' }}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Body>Check your dashboard for today&apos;s plan.</Body>
      )}

        <Button campaign="weekly_checkin" href={dashboardUrl ?? `${appUrl}/dashboard`}>{isReset && resetTask ? 'Start this now' : 'Open my dashboard'}</Button>

        <Signoff name={victoriaName} />
      </Card>

      {weeklyRecap && (
        <>
          <CardGap />
          <Card>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: INK }}>
              {gap
                ? 'Done so far this week:'
                : `This week so far: ${weeklyRecap.pointsEarned} of ${weeklyRecap.pointsTarget} points — nice work.`}
            </p>
            <ul style={recapList}>
              {weeklyRecap.completedTexts.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </CardEmail>
  )
}
