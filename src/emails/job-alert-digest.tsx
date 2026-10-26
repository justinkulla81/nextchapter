import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

export interface JobAlertEmailJob {
  title: string
  company: string
  location: string | null
  /** The tracked link: counts the click, then opens the job. */
  href: string
}

interface JobAlertDigestEmailProps {
  searchLabel: string
  jobs: JobAlertEmailJob[]
  /** Lead-gen: the next step for the journey we guessed, pre-selected. */
  startUrl: string
  startLabel: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
const jobRow: React.CSSProperties = { margin: '0 0 14px', lineHeight: '1.5' }
const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '12px',
  padding: '12px 20px',
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

/** The daily job alert: up to five new jobs for the saved search(es), then one next step. */
export default function JobAlertDigestEmail({ searchLabel, jobs, startUrl, startLabel, unsubscribeUrl }: JobAlertDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>
          {jobs.length} new {jobs.length === 1 ? 'job' : 'jobs'} for {searchLabel}
        </strong>
      </p>
      {jobs.map((j) => (
        <p key={j.href} style={jobRow}>
          <a href={j.href} style={{ fontWeight: 600 }}>
            {j.title}
          </a>
          <br />
          {j.company}
          {j.location ? ` · ${j.location}` : ''}
        </p>
      ))}
      <p style={{ marginTop: '24px' }}>These are in the order posted, with no ranking. Add your résumé and the same jobs come back ranked for you, with a fit score and the reason. Free, about five minutes.</p>
      <a href={startUrl} style={button}>
        {startLabel} →
      </a>
      <p style={footer}>
        You get this because you saved a job search at launchyournextchapter.com. At most one email a day. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
