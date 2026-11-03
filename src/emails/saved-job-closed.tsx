import { BRAND, Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

export interface ClosedJobLine { title: string; company: string }
export interface SimilarJobLine { title: string; company: string; meta: string; href: string }

interface SavedJobClosedEmailProps {
  firstName: string | null
  closed: ClosedJobLine[]
  similar: SimilarJobLine[]
  boardUrl: string
  unsubscribeUrl: string
}

/** A job the member saved is no longer listed. Says which, then shows open jobs like it. */
export default function SavedJobClosedEmail({ firstName, closed, similar, boardUrl, unsubscribeUrl }: SavedJobClosedEmailProps) {
  const one = closed.length === 1
  return (
    <CardEmail
      audience="candidate"
      preheader={one ? `${closed[0].title} at ${closed[0].company} is no longer listed.` : `${closed.length} jobs you saved are no longer listed.`}
      footer={
        <>
          You get this when a job you saved stops being listed, at most once a day.{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Stop these emails</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'}, {one ? 'a job you saved is no longer listed.' : `${closed.length} jobs you saved are no longer listed.`}</Headline>
        <div style={{ textAlign: 'left', margin: '0 0 24px' }}>
          {closed.map((j, i) => (
            <p key={i} style={{ margin: '0 0 8px', fontSize: '16px', lineHeight: '1.5', color: INK }}>
              <strong>{j.title}</strong>
              <br />
              <span style={{ color: MUTED, fontSize: '14px' }}>{j.company}</span>
            </p>
          ))}
        </div>
        {similar.length > 0 ? (
          <>
            <Lead>These similar jobs are open now:</Lead>
            <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
              {similar.map((j, i) => (
                <p key={i} style={{ margin: '0 0 16px', fontSize: '16px', lineHeight: '1.5', color: INK }}>
                  <a href={j.href} style={{ fontWeight: 600, color: BRAND, textDecoration: 'none' }}>{j.title}</a>
                  <br />
                  <span style={{ color: MUTED, fontSize: '14px' }}>{[j.company, j.meta].filter(Boolean).join(' · ')}</span>
                </p>
              ))}
            </div>
          </>
        ) : (
          <Lead>Your saved jobs and new openings are on your jobs page.</Lead>
        )}
        <Button campaign="saved_job_closed" href={boardUrl}>See open jobs</Button>
      </Card>
    </CardEmail>
  )
}
