import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface PortfolioAccessRequestEmailProps {
  firstName: string | null
  recruiterName: string
  recruiterFirm: string | null
}

export default function PortfolioAccessRequestEmail({
  firstName,
  recruiterName,
  recruiterFirm,
}: PortfolioAccessRequestEmailProps) {
  return (
    <CardEmail
      preheader={`${recruiterName}${recruiterFirm ? ` at ${recruiterFirm}` : ''} would like to see your Portfolio.`}
      audience="candidate"
      footer={<>You control this. Approving lets them view your work samples and narrative.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {recruiterName}
          {recruiterFirm ? ` at ${recruiterFirm}` : ''} would like to see your Portfolio
        </Headline>
        <Lead>Hi {firstName || 'there'},</Lead>
        <Lead>
          Your Portfolio is your work samples and narrative. They can already see your Executive Dossier and resume; this is one step more
          personal, so it&apos;s your call.
        </Lead>
        <Button href="https://launchyournextchapter.com/dashboard">Review on your dashboard</Button>
      </Card>
    </CardEmail>
  )
}
