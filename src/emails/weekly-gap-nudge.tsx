import { emailStyles } from '@/lib/email/email-styles'

interface WeeklyGapNudgeEmailProps {
  firstName: string | null
  weeklyPoints: number
  weeklyPointsTarget: number
  dashboardUrl: string
  unsubscribeUrl: string
  // True when this week's visibility-comfort check-in (VisibilityComfortCard
  // on the dashboard) hasn't been answered yet — a real, concrete gap worth
  // calling out by name rather than folding into the generic points nudge.
  visibilityCheckedIn: boolean
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
  fontSize: '15px',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function WeeklyGapNudgeEmail({
  firstName,
  weeklyPoints,
  weeklyPointsTarget,
  dashboardUrl,
  unsubscribeUrl,
  visibilityCheckedIn,
}: WeeklyGapNudgeEmailProps) {
  const pointsToGo = Math.max(0, weeklyPointsTarget - weeklyPoints)

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        {pointsToGo} points from an A this week.
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        you&apos;re at <strong>{weeklyPoints} of {weeklyPointsTarget}</strong> points for this
        week&apos;s Weekly Search Score. There&apos;s still time — the &quot;More Actions
        Available&quot; list on your dashboard has quick options beyond what you committed to,
        and anything you complete there counts too.
      </p>
      {!visibilityCheckedIn && (
        <p>
          One concrete gap: you haven&apos;t done this week&apos;s visibility check-in yet. Being
          more visible in your search — LinkedIn&apos;s &quot;Open to Work,&quot; a public post —
          is real signal recruiters actually notice, and it&apos;s a quick 5 points.
        </p>
      )}
      <a href={dashboardUrl} style={button}>
        See what&apos;s fastest to close the gap →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these weekly nudges
        </a>
      </p>
    </div>
  )
}
