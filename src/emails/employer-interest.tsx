import { Button, Card, CardEmail, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface EmployerInterestEmailProps {
  firstName: string | null
  companyName: string
}

export default function EmployerInterestEmail({ firstName, companyName }: EmployerInterestEmailProps) {
  return (
    <CardEmail preheader={`${companyName} is interested in your profile`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {firstName || 'Hi there'}, {companyName} is interested in your profile
        </Headline>
        <Lead>You decide whether to reveal your identity to them — nothing is shared automatically.</Lead>
        <Button href="https://launchyournextchapter.com/dashboard">Review on your dashboard</Button>
        <Small>You control this. Approving lets them see your name and full work history.</Small>
      </Card>
    </CardEmail>
  )
}
