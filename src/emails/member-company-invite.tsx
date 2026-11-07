import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface Props {
  orgName: string
  companyName: string
  acceptUrl: string
}

// A workforce org invites a hiring member company to see local job seekers
// who chose to share their Dossier.
export default function MemberCompanyInviteEmail({ orgName, companyName, acceptUrl }: Props) {
  return (
    <CardEmail preheader={`${orgName} gave ${companyName} access to its member portal.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark />
        <Headline>{orgName} gave {companyName} access to its member portal</Headline>
        <Body>Hi there,</Body>
        <Body>
          {orgName} has given {companyName} access to its member portal. When you have a layoff, ask for free career-support seats for your people and see how they&apos;re doing
          (counts only). When you&apos;re hiring, meet local job seekers who chose to share a verified profile, and ask for an introduction. Each person says yes or no.
        </Body>
        <LinkButton href={acceptUrl}>Open your company portal</LinkButton>
        <Small>This link signs you in once. If you weren&apos;t expecting it, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
