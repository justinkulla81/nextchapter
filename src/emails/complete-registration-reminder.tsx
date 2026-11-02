import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface CompleteRegistrationReminderEmailProps {
  firstName: string | null
  gradeDescription: string
  magicLink: string
  unsubscribeUrl: string
}

export default function CompleteRegistrationReminderEmail({
  firstName,
  gradeDescription,
  magicLink,
  unsubscribeUrl,
}: CompleteRegistrationReminderEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader="Your full report is still locked. Finish creating your account."
      footer={
        <>
          Didn&apos;t mean to start this? You can{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            stop these reminders
          </a>{' '}
          at any time.
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Hi {firstName || 'there'}, you built your NextChapter profile and got an honest read on where you stand: {gradeDescription}.
        </Headline>
        <Lead>
          But you never finished creating your account, so your full report (strengths, gaps, and an action plan) is still locked.
        </Lead>
        <Lead>Click below to pick up exactly where you left off — no password needed.</Lead>
        <Button href={magicLink}>Finish creating my account</Button>
      </Card>
    </CardEmail>
  )
}
