import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface JobSavedEmailProps {
  title: string
  company: string
  jobUrl: string
  fitUrl: string
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

/** Sent once when someone saves a public job page with their email. */
export default function JobSavedEmail({ title, company, jobUrl, fitUrl, unsubscribeUrl }: JobSavedEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>
          Saved: {title} at {company}
        </strong>
      </p>
      <p>
        <a href={jobUrl}>Open the job again</a> any time while it is listed.
      </p>
      <p>Want to know how well you fit? Add your résumé and every job comes back ranked for you, with a fit score and the reason. It is free and takes about five minutes.</p>
      <a href={fitUrl} style={button}>
        See how I fit →
      </a>
      <p style={footer}>
        You saved this job at launchyournextchapter.com. This is the only email we send for it.{' '}
        <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
