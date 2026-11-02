import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface JobAlertConfirmEmailProps {
  /** What they asked for, as a phrase: "new jobs matching marketing manager in Chicago". */
  what: string
  confirmUrl: string
  unsubscribeUrl: string
}

/** Sent once after someone saves a job search. Alerts start only after they click. */
export default function JobAlertConfirmEmail({ what, confirmUrl, unsubscribeUrl }: JobAlertConfirmEmailProps) {
  return (
    <CardEmail
      preheader="Confirm your email alerts"
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Confirm your email alerts</Headline>
        <Lead>You asked for {what}. One click and we start. We send at most one email a day, and only when there is something new.</Lead>
        <Button href={confirmUrl}>Yes, send me the alerts</Button>
        <Small>If you did not ask for this, ignore this email and nothing will be sent.</Small>
      </Card>
    </CardEmail>
  )
}
