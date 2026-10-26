import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface JobAlertConfirmEmailProps {
  searchLabel: string
  confirmUrl: string
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
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '16px',
  padding: '12px 20px',
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

/** Sent once after someone saves a job search. Alerts start only after they click. */
export default function JobAlertConfirmEmail({ searchLabel, confirmUrl, unsubscribeUrl }: JobAlertConfirmEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>Confirm your job alerts</strong>
      </p>
      <p>You asked for new jobs matching {searchLabel}. One click and we start. We send at most one email a day, and only when there is something new.</p>
      <a href={confirmUrl} style={button}>
        Yes, send me new jobs →
      </a>
      <p style={footer}>
        If you did not ask for this, ignore this email and nothing will be sent. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
