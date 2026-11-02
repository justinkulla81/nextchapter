import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface UnlockRecruiterNetworkNudgeEmailProps {
  firstName: string | null
  privacyUrl: string
  unsubscribeUrl: string
}

// Sent to A-grade candidates who haven't opted into the Recruiter Database
// yet — framed around the benefit to them (recruiters looking at them),
// not "so we can show you to recruiters." Reused by both the weekly cron
// (lockedAGrade bucket) and the admin's manual "Nudge to unlock" button.
export default function UnlockRecruiterNetworkNudgeEmail({
  firstName,
  privacyUrl,
  unsubscribeUrl,
}: UnlockRecruiterNetworkNudgeEmailProps) {
  return (
    <CardEmail
      preheader="Your Market Reality Assessment just hit an A."
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe from these nudges</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your Market Reality Assessment just hit an A</Headline>
        <Lead>Hi {firstName || 'there'},</Lead>
        <Lead>
          That puts you in range for the Recruiter Database, where vetted recruiters browse for candidates who&apos;ve already proven real
          search execution.
        </Lead>
        <Lead>You haven&apos;t opted in yet. It&apos;s one toggle on your Privacy page, and you can turn it back off anytime.</Lead>
        <Button href={privacyUrl}>Turn on Recruiter Database</Button>
      </Card>
    </CardEmail>
  )
}
