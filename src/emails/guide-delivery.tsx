import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface GuideDeliveryEmailProps {
  firstName: string | null
  guideTitle: string
  downloadUrl: string
}

export default function GuideDeliveryEmail({ firstName, guideTitle, downloadUrl }: GuideDeliveryEmailProps) {
  return (
    <CardEmail
      preheader={`Here's your copy of ${guideTitle}.`}
      audience="candidate"
      footer={<>We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Here&apos;s your copy of {guideTitle}</Headline>
        <Lead>Hi {firstName || 'there'},</Lead>
        <Button href={downloadUrl}>Download the guide</Button>
      </Card>
    </CardEmail>
  )
}
