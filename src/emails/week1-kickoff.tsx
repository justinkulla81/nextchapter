import { emailStyles } from '@/lib/email/email-styles'

interface Week1KickoffEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  artifactLabels: string[]
  topActions: string[]
  appUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const list: React.CSSProperties = {
  paddingLeft: '20px',
  marginTop: '12px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '24px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function Week1KickoffEmail({
  firstName,
  victoriaName,
  artifactLabels,
  topActions,
  appUrl,
  unsubscribeUrl,
}: Week1KickoffEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        Hi {firstName || 'there'} — I&apos;m {victoriaName}, your AI coach here at NextChapter.
        I&apos;ll check in with you, help build your plan, and always give it to you straight — but
        I&apos;m completely in your corner. Let&apos;s get started.
      </p>
      {topActions.length > 0 && (
        <>
          <p>Your action plan is ready. Here&apos;s where I&apos;d start:</p>
          <ul style={list}>
            {topActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </>
      )}
      <p>
        Your first week isn&apos;t about hitting a points target — it&apos;s about producing 5 real
        things you&apos;ll use for the rest of your search:
      </p>
      <ul style={list}>
        {artifactLabels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p>Do these five, and you&apos;ll walk into next week with real material to work from.</p>

      <a href={`${appUrl}/dashboard`} style={button}>
        See my first-week checklist
      </a>

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
