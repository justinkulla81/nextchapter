import type { ReviewEmailContent } from '@/lib/in-work/outreach'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface InWorkReviewEmailProps {
  firstName: string | null
  content: ReviewEmailContent
  appUrl: string
  unsubscribeUrl: string
}

// Plain by design: no employer name, no job-search wording, nothing that
// looks wrong on a shared or work screen.
export default function InWorkReviewEmail({ firstName, content, appUrl, unsubscribeUrl }: InWorkReviewEmailProps) {
  const base = `${appUrl}/dashboard/in-work`
  return (
    <CardEmail
      preheader={content.intro}
      audience="candidate"
      footer={
        <>
          This goes only to you. Nothing in your workspace is shared with anyone at work.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Turn these reminders off</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'},</Headline>
        <Lead>{content.intro}</Lead>
        <div style={{ textAlign: 'left', margin: '0 auto 28px', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6' }}>
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {content.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <Button href={`${base}${content.ctaQuery}`}>{content.ctaLabel}</Button>
        {content.secondaryLabel && content.secondaryQuery && (
          <Small>
            Or <a href={`${base}${content.secondaryQuery}`} style={{ color: MUTED }}>{content.secondaryLabel.toLowerCase()}</a>.
          </Small>
        )}
      </Card>
    </CardEmail>
  )
}
