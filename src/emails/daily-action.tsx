import { emailStyles } from '@/lib/email/email-styles'

interface DailyActionEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  isReset: boolean
  bullets: string[] | null
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

const footer: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function DailyActionEmail({
  firstName,
  victoriaName,
  isReset,
  bullets,
  appUrl,
  unsubscribeUrl,
}: DailyActionEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'} — {victoriaName} here.</p>

      {isReset ? (
        <p>
          You haven&apos;t fallen behind. The plan got too heavy. Today, do one small thing — takes
          5 minutes — and we restart. I&apos;ll be here. — {victoriaName}
        </p>
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
