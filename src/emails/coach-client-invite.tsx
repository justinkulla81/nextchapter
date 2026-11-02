import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface CoachClientInviteEmailProps {
  coachName: string
  firmName: string | null
  acceptUrl: string
}

export default function CoachClientInviteEmail({ coachName, firmName, acceptUrl }: CoachClientInviteEmailProps) {
  return (
    <CardEmail
      preheader={`${coachName} invited you to work together on NextChapter.`}
      audience="candidate"
      footer="If you weren't expecting this, you can ignore this email."
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{coachName} invited you to work together</Headline>
        <Lead>
          {coachName}
          {firmName ? ` (${firmName})` : ''} invited you to NextChapter, a free platform that turns your job search into a structured, coached plan.
        </Lead>
        <Button href={acceptUrl}>Set up your account</Button>
      </Card>
    </CardEmail>
  )
}
