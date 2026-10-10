import { emailStyles } from '@/lib/email/email-styles'

export interface FreshJobAlertJob {
  title: string
  company: string
  location: string | null
  postedAgo: string
}

interface FreshJobAlertEmailProps {
  firstName: string | null
  jobs: FreshJobAlertJob[]
  boardUrl: string
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

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '20px',
  padding: '10px 16px',
  backgroundColor: '#0b2545',
  color: '#ffffff',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 600,
}

const muted: React.CSSProperties = { ...emailStyles.muted }

/** Instant alert: strong-fit jobs posted in the last day — apply while they're fresh. */
export default function FreshJobAlertEmail({ firstName, jobs, boardUrl, unsubscribeUrl }: FreshJobAlertEmailProps) {
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545', margin: 0 }}>NextChapter</p>
      <p style={{ marginTop: '24px' }}>Hi {firstName || 'there'},</p>
      <p>
        {jobs.length === 1 ? 'A role that closely matches your background was' : `${jobs.length} roles that closely match your background were`}{' '}
        just posted. Early
        applicants get most of the interviews, so it&apos;s worth applying today.
      </p>
      <ul style={{ paddingLeft: '18px' }}>
        {jobs.map((j, i) => (
          <li key={i} style={{ marginBottom: '8px' }}>
            <strong>{j.title}</strong>
            <br />
            <span style={muted}>
              {[j.company, j.location, j.postedAgo].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      <a href={boardUrl} style={button}>
        See them and apply →
      </a>
      <p style={{ ...muted, marginTop: '32px', fontSize: '12px' }}>
        You only get this when a very strong match is posted — at most once a day.{' '}
        <a href={unsubscribeUrl} style={muted}>
          Stop new-job alerts
        </a>
      </p>
    </div>
  )
}
