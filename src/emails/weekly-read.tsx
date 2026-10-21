import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

export interface WeeklyReadEmailProps {
  firstName: string | null
  headline: string
  lines: string[]
  next: { title: string; url: string } | null
  reportUrl: string
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
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
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
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

// The weekly "what changed" note. Sent only when something in the member's read actually moved,
// and only to members who have opened the report before (so there is a read to compare against).
export default function WeeklyReadEmail({ firstName, headline, lines, next, reportUrl, unsubscribeUrl }: WeeklyReadEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{headline}</p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        here is what changed in how the market reads you since you last looked.
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        {lines.map((l) => (
          <li key={l} style={{ marginBottom: '6px' }}>
            {l}
          </li>
        ))}
      </ul>
      {next && (
        <p>
          <strong>Next:</strong> {next.title}.{' '}
          <a href={next.url} style={{ color: '#2e7d5b' }}>
            Do it now
          </a>
        </p>
      )}
      <a href={reportUrl} style={button}>
        See your full Market Reality Report →
      </a>
      <p style={footer}>
        These numbers are working estimates and move as your own results come in.{' '}
        <a href={unsubscribeUrl} style={{ color: '#8892a0' }}>
          Unsubscribe from weekly emails
        </a>
        .
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
