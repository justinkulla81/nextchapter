import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface FriendReferralEmailProps {
  referrerEmail: string
}

export default function FriendReferralEmail({ referrerEmail }: FriendReferralEmailProps) {
  return (
    <CardEmail
      preheader={`${referrerEmail} thought of you and wanted to pass along NextChapter.`}
      audience="candidate"
      footer={<>If you weren&apos;t expecting this, you can safely ignore it — no account was created and nothing else will be sent.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{referrerEmail} thought of you</Headline>
        <Lead>
          They wanted to pass along NextChapter — a platform for people between chapters of their career. It gives you an honest read on where
          you stand and a real weekly plan, not just another job board.
        </Lead>
        <Lead>It&apos;s free for candidates, always.</Lead>
        <Button href="https://launchyournextchapter.com">Take a look</Button>
      </Card>
    </CardEmail>
  )
}
