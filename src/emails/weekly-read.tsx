import { Button, Card, CardEmail, GREEN, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

export interface WeeklyReadEmailProps {
  firstName: string | null
  headline: string
  lines: string[]
  next: { title: string; url: string } | null
  reportUrl: string
  unsubscribeUrl: string
}

// The weekly "what changed" note. Sent only when something in the member's read actually moved,
// and only to members who have opened the report before (so there is a read to compare against).
export default function WeeklyReadEmail({ firstName, headline, lines, next, reportUrl, unsubscribeUrl }: WeeklyReadEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={headline}
      footer={
        <>
          These numbers are working estimates and move as your own results come in.{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Unsubscribe from weekly emails
          </a>
          .
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}
          here is what changed in how the market reads you since you last looked.
        </Lead>
        <div style={{ textAlign: 'left', margin: '0 auto 28px', maxWidth: '500px', fontSize: '16px', lineHeight: '1.6' }}>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {lines.map((l) => (
              <li key={l} style={{ marginBottom: '6px' }}>
                {l}
              </li>
            ))}
          </ul>
          {next && (
            <p style={{ margin: '16px 0 0' }}>
              <strong>Next:</strong> {next.title}.{' '}
              <a href={next.url} style={{ color: GREEN }}>
                Do it now
              </a>
            </p>
          )}
        </div>
        <Button href={reportUrl}>See your full Market Reality Report</Button>
      </Card>
    </CardEmail>
  )
}
