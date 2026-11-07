import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface EmployerSeatInviteEmailProps {
  companyName: string
  inviterName: string | null
  acceptUrl: string
}

export default function EmployerSeatInviteEmail({ companyName, inviterName, acceptUrl }: EmployerSeatInviteEmailProps) {
  return (
    <CardEmail preheader={`Join ${companyName}'s hiring team on NextChapter.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Employer seat invite" />
        <Headline>Join {companyName}&apos;s hiring team</Headline>
        <Body>Hi there,</Body>
        <Body>
          {inviterName || 'A teammate'} invited you to join <strong>{companyName}</strong>&apos;s hiring team on
          NextChapter. You&apos;ll get access to the same roles, candidates, and hiring analytics.
        </Body>
        <LinkButton href={acceptUrl}>Accept invite →</LinkButton>
        <Small>If you weren&apos;t expecting this, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
