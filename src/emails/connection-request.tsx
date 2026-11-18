import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface Props {
  fromName: string
  fromLabel: string
  toName: string
  url: string
}

// One organization asks to connect its portal with another's (connected portals). The other side's admin accepts or declines.
export default function ConnectionRequestEmail({ fromName, fromLabel, toName, url }: Props) {
  return (
    <CardEmail preheader={`${fromName} asked to connect with ${toName} on NextChapter.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Connection request" />
        <Headline>{fromName} asked to connect with {toName}</Headline>
        <Body>Hi there,</Body>
        <Body>
          {fromName} ({fromLabel.toLowerCase()}) wants to connect its NextChapter portal with yours. Once you accept, each of you chooses what to share with the other:
          jobs, events and layoffs. Either side can change that or disconnect at any time. Nothing about individual people is shared.
        </Body>
        <LinkButton href={url}>Answer the request</LinkButton>
        <Small>If you weren&apos;t expecting this, you can ignore it. Nothing is shared until you accept.</Small>
      </Card>
    </CardEmail>
  )
}
