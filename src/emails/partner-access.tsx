import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface Props {
  orgName: string
  partnerName: string
  acceptUrl: string
}

// A workforce organization gives a confirmed partner's contact their own page in its portal.
export default function PartnerAccessEmail({ orgName, partnerName, acceptUrl }: Props) {
  return (
    <CardEmail preheader={`${orgName} gave ${partnerName} a page in its talent network.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Partner access" />
        <Headline>{orgName} gave {partnerName} a page in its talent network</Headline>
        <Body>Hi there,</Body>
        <Body>
          You asked to join {orgName}&apos;s talent network and they confirmed {partnerName}. This is your page: what you offered, a way to update it, and anything {orgName} shared with
          you. It shows nothing about individual job seekers.
        </Body>
        <LinkButton href={acceptUrl}>Open your partner page</LinkButton>
        <Small>This link signs you in once. If you weren&apos;t expecting it, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
