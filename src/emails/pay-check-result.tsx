import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface PayCheckResultEmailProps {
  title: string
  sentence: string
  rangeLine: string
  salaryUrl: string
  startUrl: string
  unsubscribeUrl: string
}

/** Sent once when someone asks for their pay check result by email. */
export default function PayCheckResultEmail({ title, sentence, rangeLine, salaryUrl, startUrl, unsubscribeUrl }: PayCheckResultEmailProps) {
  return (
    <CardEmail
      preheader={sentence}
      audience="candidate"
      footer={
        <>
          You asked for this at launchyournextchapter.com. This is the only email we send for it.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your pay check: {title}</Headline>
        <Lead>{sentence}</Lead>
        <Lead>
          <strong>{rangeLine}</strong>
        </Lead>
        <Lead>
          This is pay employers list in current job postings, not what people are paid, and it does not account for your city, level or industry.{' '}
          <a href={salaryUrl}>See the full range</a>.
        </Lead>
        <Lead>Add your résumé and every open job comes back ranked for you, with a fit score and the reason. Free, about five minutes.</Lead>
        <Button href={startUrl}>See how I fit</Button>
      </Card>
    </CardEmail>
  )
}
