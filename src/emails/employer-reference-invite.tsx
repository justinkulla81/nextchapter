import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface EmployerReferenceInviteEmailProps {
  managerName: string
  managerCompany: string
  employeeFirstName: string
  claimUrl: string
}

// Prompt 65 section 6 — deliberately warmer and more specific than any
// cold-outreach template elsewhere in the app: this is a real, named
// person vouching for the recipient, not a marketing send. Nothing about
// the reference itself is visible until they follow this link and
// explicitly accept it (see the consent model in Prompt 65 section 1).
export default function EmployerReferenceInviteEmail({
  managerName,
  managerCompany,
  employeeFirstName,
  claimUrl,
}: EmployerReferenceInviteEmailProps) {
  return (
    <CardEmail preheader={`${managerName} at ${managerCompany} left you a reference.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Employer reference invite" />
        <Headline>{managerName} left you a reference</Headline>
        <Body>Hi {employeeFirstName},</Body>
        <Body>
          {managerName} at {managerCompany} wanted to make sure you landed well — they left you a
          reference and an invitation to NextChapter, the leading job transition platform, which is free
          to join and turns a job search into a structured, coached plan.
        </Body>
        <Body>
          Nothing from their reference is used or shared anywhere until you&apos;ve seen it yourself and
          chosen to accept it.
        </Body>
        <LinkButton href={claimUrl}>Review {managerName.split(' ')[0]}&apos;s reference →</LinkButton>
        <Small>If you weren&apos;t expecting this, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
