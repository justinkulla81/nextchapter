import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface PayCheckResultEmailProps {
  title: string
  sentence: string
  rangeLine: string
  salaryUrl: string
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

/** Sent once when someone asks for their pay check result by email. */
export default function PayCheckResultEmail({ title, sentence, rangeLine, salaryUrl, startUrl, unsubscribeUrl }: PayCheckResultEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>Your pay check: {title}</strong>
      </p>
      <p>{sentence}</p>
      <p>{rangeLine}</p>
      <p>
        This is pay employers list in current job postings, not what people are paid, and it does not account for your city, level or industry. <a href={salaryUrl}>See the full range</a>.
      </p>
      <p>Add your résumé and every open job comes back ranked for you, with a fit score and the reason. Free, about five minutes.</p>
      <a href={startUrl} style={button}>
        See how I fit →
      </a>
      <p style={footer}>
        You asked for this at launchyournextchapter.com. This is the only email we send for it. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
