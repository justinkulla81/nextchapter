import { emailStyles } from '@/lib/email/email-styles'

interface CommunityCoachingDigestEmailProps {
  firstName: string | null
  encouragementCount: number
  hadCoachSession: boolean
  dashboardUrl: string
  unsubscribeUrl: string
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

export default function CommunityCoachingDigestEmail({
  firstName,
  encouragementCount,
  hadCoachSession,
  dashboardUrl,
  unsubscribeUrl,
}: CommunityCoachingDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>Your week in review.</p>
      <p>{firstName ? `Hi ${firstName}, ` : ''}here&apos;s what happened this week:</p>

      {encouragementCount > 0 && (
        <p>
          You received <strong>{encouragementCount}</strong> encouragement note
          {encouragementCount === 1 ? '' : 's'} from your Support Network.
        </p>
      )}
      {hadCoachSession && (
        <p>
          You had a coaching session this week — check your dashboard for what changed since last
          time.
        </p>
      )}

      <a href={dashboardUrl} style={button}>
        See it on your dashboard →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these weekly nudges
        </a>
      </p>
    </div>
  )
}
