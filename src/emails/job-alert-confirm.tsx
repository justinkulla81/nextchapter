import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface JobAlertConfirmEmailProps {
  /** What they asked for, as a phrase: "new jobs matching marketing manager in Chicago". */
  what: string
  confirmUrl: string
  unsubscribeUrl: string
  /** A course path (/ai-courses) reads differently from an alert: one link, nothing recurring is promised. */
  variant?: 'course_path'
  /** The one follow-up to a confirmation that was never clicked. */
  reminder?: boolean
}

/** Sent once after someone saves a job search. Alerts start only after they click. */
export default function JobAlertConfirmEmail({ what, confirmUrl, unsubscribeUrl, variant, reminder }: JobAlertConfirmEmailProps) {
  return (
    <CardEmail
      preheader="Confirm your email alerts"
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        {variant === 'course_path' ? (
          <>
            <Headline>Your AI course path</Headline>
            <Lead>You asked for {what}. One click opens it.</Lead>
            <Button href={confirmUrl}>Open my course path</Button>
          </>
        ) : (
          <>
            <Headline>{reminder ? 'Still want these alerts?' : 'Confirm your email alerts'}</Headline>
            <Lead>
              {reminder ? `A few days ago you asked for ${what}. We have not started because we are waiting for your yes. ` : `You asked for ${what}. `}One click and we start. We send at most one email a day, and only when there is something new.
            </Lead>
            <Button href={confirmUrl}>Yes, send me the alerts</Button>
          </>
        )}
        <Small>{reminder ? 'This is the only reminder. If you do not want alerts, ignore this email and nothing will be sent.' : 'If you did not ask for this, ignore this email and nothing will be sent.'}</Small>
      </Card>
    </CardEmail>
  )
}
