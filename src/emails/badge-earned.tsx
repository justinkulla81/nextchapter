import { emailStyles } from '@/lib/email/email-styles'

interface BadgeEarnedEmailProps {
  firstName: string | null
  badgeLabels: string[]
  statsUrl: string
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

const badgeBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#eaf4ef',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '20px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function BadgeEarnedEmail({ firstName, badgeLabels, statsUrl, unsubscribeUrl }: BadgeEarnedEmailProps) {
  const headline = badgeLabels.length === 1 ? `You just earned "${badgeLabels[0]}."` : 'You just earned new badges.'
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{headline}</p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        real work you logged just earned {badgeLabels.length === 1 ? 'this' : 'these'}:
      </p>
      <div style={badgeBox}>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {badgeLabels.map((label) => (
            <li key={label} style={{ fontWeight: 600 }}>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <a href={statsUrl} style={button}>
        See your badges →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these emails
        </a>
      </p>
    </div>
  )
}
