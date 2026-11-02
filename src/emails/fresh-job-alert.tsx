import { BRAND, Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

/** One job, as the board card says it (job-card.ts): verdict, meta line, why line. */
export interface FreshJobAlertJob {
  title: string
  company: string
  /** "Strong fit" / "Good fit" / "Worth a look". */
  verdict: string
  /** "Posted 3 hours ago · Louisville, KY · $180k–$220k · Likely fewer applicants (on-site)". */
  meta: string
  /** "Fits you: your level · finance — Gap: asks for SQL"; null when nothing specific is known. */
  why: string | null
}

interface FreshJobAlertEmailProps {
  firstName: string | null
  jobs: FreshJobAlertJob[]
  boardUrl: string
  unsubscribeUrl: string
}

/** Instant alert: strong-fit jobs posted in the last day — apply while they're fresh. */
export default function FreshJobAlertEmail({ firstName, jobs, boardUrl, unsubscribeUrl }: FreshJobAlertEmailProps) {
  const matchLine =
    jobs.length === 1 ? 'A role that closely matches your background was' : `${jobs.length} roles that closely match your background were`
  return (
    <CardEmail
      audience="candidate"
      preheader={`${matchLine} just posted.`}
      footer={
        <>
          You only get this when a role that&apos;s a strong fit for you is posted — at most once a day.{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Stop new-job alerts
          </a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Hi {firstName || 'there'}, {matchLine.charAt(0).toLowerCase() + matchLine.slice(1)} just posted.
        </Headline>
        <Lead>Early applicants get most of the interviews, so it&apos;s worth applying today.</Lead>
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          {jobs.map((j, i) => (
            <p key={i} style={{ margin: '0 0 16px', fontSize: '16px', lineHeight: '1.5', color: INK }}>
              <span style={{ fontWeight: 600, color: BRAND }}>{j.verdict}: </span>
              <strong>{j.title}</strong>
              <br />
              <span style={{ color: MUTED, fontSize: '14px' }}>{[j.company, j.meta].filter(Boolean).join(' · ')}</span>
              {j.why && (
                <>
                  <br />
                  <span style={{ color: MUTED, fontSize: '14px' }}>{j.why}</span>
                </>
              )}
            </p>
          ))}
        </div>
        <Button campaign="fresh_job_alert" href={boardUrl}>See them and apply</Button>
      </Card>
    </CardEmail>
  )
}
