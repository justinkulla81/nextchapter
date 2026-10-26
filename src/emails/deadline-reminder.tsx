import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface DeadlineReminderEmailProps {
  title: string
  body: string
  /** "Your last day was Oct 1, 2026." */
  context: string
  stateUrl: string | null
  startUrl: string
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

/** One reminder from the layoff deadline checker. */
export default function DeadlineReminderEmail({ title, body, context, stateUrl, startUrl, unsubscribeUrl }: DeadlineReminderEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>{title}</strong>
      </p>
      <p>{body}</p>
      <p style={emailStyles.muted}>{context} Dates are counted from your last day and are a guide: confirm the exact date on your own paperwork.</p>
      {stateUrl && (
        <p>
          <a href={stateUrl}>Unemployment benefits for your state</a>
        </p>
      )}
      <p>Want a short plan for the rest of the week, and jobs ranked for you? It is free and takes about five minutes to start.</p>
      <a href={startUrl} style={button}>
        See the first-week plan →
      </a>
      <p style={footer}>
        You asked for these reminders at launchyournextchapter.com. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
