interface DailyActionEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  greetingLine: string
  primaryActionText: string | null
  whyItMatters: string | null
  engineHint: string | null
  isReset: boolean
  appUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const actionBox: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px',
  marginTop: '16px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  fontWeight: 600,
  marginTop: '16px',
}

const footer: React.CSSProperties = {
  color: '#4a5568',
  fontSize: '13px',
  marginTop: '32px',
}

export default function DailyActionEmail({
  firstName,
  victoriaName,
  greetingLine,
  primaryActionText,
  whyItMatters,
  engineHint,
  isReset,
  appUrl,
  unsubscribeUrl,
}: DailyActionEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        Hi {firstName || 'there'}, {greetingLine}
      </p>

      {isReset ? (
        <p>
          You haven&apos;t fallen behind. The plan got too heavy. Today, do one small thing — takes
          5 minutes — and we restart. I&apos;ll be here. — {victoriaName}
        </p>
      ) : primaryActionText ? (
        <div style={actionBox}>
          <p style={{ fontWeight: 600, margin: 0 }}>Today&apos;s move:</p>
          <p style={{ marginTop: '8px' }}>{primaryActionText}</p>
          {whyItMatters && <p style={{ color: '#4a5568', fontSize: '14px' }}>{whyItMatters}</p>}
          {engineHint && (
            <p style={{ color: '#4a5568', fontSize: '13px' }}>Moves your {engineHint}.</p>
          )}
        </div>
      ) : (
        <p>Check your dashboard for today&apos;s plan.</p>
      )}

      <a href={`${appUrl}/dashboard`} style={button}>
        Open my dashboard
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
