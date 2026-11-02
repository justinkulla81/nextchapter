import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface DeadlineReminderEmailProps {
  title: string
  body: string
  /** "Your last day was Oct 1, 2026." */
  context: string
  stateUrl: string | null
  startUrl: string
  unsubscribeUrl: string
}

/** One reminder from the layoff deadline checker. */
export default function DeadlineReminderEmail({ title, body, context, stateUrl, startUrl, unsubscribeUrl }: DeadlineReminderEmailProps) {
  return (
    <CardEmail
      preheader={body}
      audience="candidate"
      footer={
        <>
          You asked for these reminders at launchyournextchapter.com.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{title}</Headline>
        <Lead>{body}</Lead>
        <Small>{context} Dates are counted from your last day and are a guide: confirm the exact date on your own paperwork.</Small>
        {stateUrl && (
          <p style={{ margin: '16px 0 0', fontSize: '16px' }}>
            <a href={stateUrl}>Unemployment benefits for your state</a>
          </p>
        )}
        <div style={{ height: '28px', lineHeight: '28px', fontSize: '28px' }}>&nbsp;</div>
        <Lead>Want a short plan for the rest of the week, and jobs ranked for you? It is free and takes about five minutes to start.</Lead>
        <Button campaign="deadline_reminder" href={startUrl}>See the first-week plan</Button>
      </Card>
    </CardEmail>
  )
}
