import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface OutplacementOrgInviteEmailProps {
  orgName: string
  roleLabel: string
  acceptUrl: string
}

// Sent to a new NextChapter for Employers portal user (admin/viewer/
// legal/finance) — either the primary contact NextChapter admin sets up
// when a contract is created, or a teammate an existing employer_admin
// invites.
export default function OutplacementOrgInviteEmail({ orgName, roleLabel, acceptUrl }: OutplacementOrgInviteEmailProps) {
  return (
    <CardEmail preheader={`You've been added to ${orgName}'s NextChapter for Employers account.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Outplacement org invite" />
        <Headline>You&apos;ve been added to {orgName}&apos;s account</Headline>
        <Body>Hi there,</Body>
        <Body>
          You&apos;ve been added to {orgName}&apos;s NextChapter for Employers account as {roleLabel}. Set up your
          account to get started.
        </Body>
        <LinkButton href={acceptUrl}>Set up your account →</LinkButton>
        <Small>If you weren&apos;t expecting this, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
