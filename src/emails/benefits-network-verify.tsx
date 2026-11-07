import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface BenefitsNetworkVerifyEmailProps {
  alumName: string
  institutionName: string
  programName: string
  confirmUrl: string
}

export default function BenefitsNetworkVerifyEmail({
  alumName,
  institutionName,
  programName,
  confirmUrl,
}: BenefitsNetworkVerifyEmailProps) {
  return (
    <CardEmail preheader={`Confirm ${programName} from ${institutionName}.`} audience="organization">
      <Card pad="28px 32px 36px">
        <Wordmark label="Benefits network verify" />
        <Headline>Confirm this offer from {institutionName}</Headline>
        <Body>Hi there,</Body>
        <Body>
          {alumName} has proposed listing <strong>{programName}</strong> from{' '}
          <strong>{institutionName}</strong> on NextChapter&apos;s Higher Education Benefits Network — a catalog of discounts
          and programs offered to NextChapter members through alumni relationships.
        </Body>
        <Body>
          Because you&apos;re receiving this at an address on {institutionName}&apos;s own domain, clicking the link
          below confirms that this offer is real and that {alumName} is authorized to extend it on the
          institution&apos;s behalf. The listing will not appear in our catalog until this is confirmed.
        </Body>
        <LinkButton href={confirmUrl}>Confirm this offer →</LinkButton>
        <Small>
          If you weren&apos;t expecting this or don&apos;t recognize {alumName}, you can safely ignore this email — the
          listing will simply never go live.
        </Small>
      </Card>
    </CardEmail>
  )
}
