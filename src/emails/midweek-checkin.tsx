import { emailStyles } from '@/lib/email/email-styles'

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
  appUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const bulletList: React.CSSProperties = {
  paddingLeft: '20px',
  marginTop: '16px',
}

const bulletItem: React.CSSProperties = {
  marginTop: '8px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '24px',
  ...emailStyles.cta,
}

const taskBox: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  margin: '16px 0',
  padding: '16px 18px',
  borderRadius: '8px',
  backgroundColor: '#f4f6f4',
  borderLeft: '4px solid #2e7d5b',
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  marginTop: '32px',
  ...emailStyles.muted,
}

const recapBox: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  marginTop: '28px',
  padding: '16px 18px',
  borderRadius: '8px',
  backgroundColor: '#f4f6f4',
}

const recapTitle: React.CSSProperties = {
  fontWeight: 700,
  color: '#0b2545',
  margin: 0,
}

const recapList: React.CSSProperties = {
  paddingLeft: '18px',
  margin: '8px 0 0',
  fontSize: '14px',
  color: '#4a5568',
}

export default function MidweekCheckinEmail({
  firstName,
  victoriaName,
  introCopy,
  isReset,
  resetTask,
  bullets,
  weeklyRecap,
  appUrl,
  unsubscribeUrl,
}: MidweekCheckinEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'} — {victoriaName} here. Midweek check-in:</p>

      {introCopy && <p>{introCopy}</p>}

      {isReset ? (
        <>
          <p>
            I noticed you haven&apos;t checked in for a few days. A job search is hard, and it only
            works with steady effort — but you don&apos;t have to do it alone. We&apos;re here to help.
            You just need to get started.
          </p>
          <p>
            {resetTask ? 'Today, just do this:' : 'Today, pick one small thing and do it.'}
          </p>
          {resetTask && <p style={taskBox}>{resetTask}</p>}
          <p>
            Five minutes, then you&apos;re back in motion. I&apos;ll be here. — {victoriaName}
          </p>
        </>
      ) : bullets ? (
        <ul style={bulletList}>
          {bullets.map((bullet, i) => (
            <li key={i} style={bulletItem}>
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p>Check your dashboard for today&apos;s plan.</p>
      )}

      <a href={`${appUrl}/dashboard`} style={button}>
        {isReset && resetTask ? 'Start this now' : 'Open my dashboard'}
      </a>

      {weeklyRecap && (
        <div style={recapBox}>
          <p style={recapTitle}>
            This week so far: {weeklyRecap.pointsEarned} of {weeklyRecap.pointsTarget} points — nice
            work.
          </p>
          <ul style={recapList}>
            {weeklyRecap.completedTexts.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </div>
      )}

      <p style={footer}>
        Don&apos;t want daily emails?{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn them off
        </a>
        .
      </p>
    </div>
  )
}
