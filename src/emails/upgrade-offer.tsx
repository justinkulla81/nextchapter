import type { OfferCopy } from '@/lib/upgrade-offer/triggers'
import { Body, Button, Card, CardEmail, CardGap, FeatureRow, Headline, Hero, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface UpgradeOfferEmailProps {
  copy: OfferCopy
  planName: string
  ctaUrl: string
  unsubscribeUrl: string
}

// The reference card email: wordmark, one large headline, a hero card showing the
// member's own number, one button, three short benefit rows, and a closing button.
// The parts live in @/lib/email/card-layout so other emails share the same look.
export default function UpgradeOfferEmail({ copy, planName, ctaUrl, unsubscribeUrl }: UpgradeOfferEmailProps) {
  return (
    <CardEmail
      preheader={copy.preheader}
      audience="candidate"
      footer={
        <>
          You are getting this because of your numbers in NextChapter. We send at most one of these every three weeks.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Stop these emails</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{copy.headline}</Headline>
        <Hero value={copy.hero.value} caption={copy.hero.caption} />
        <Lead>{copy.intro}</Lead>
        <Button href={ctaUrl}>See {planName}</Button>
        <Small>Cancel anytime.</Small>
      </Card>
      <CardGap />

      {copy.features.map((f) => (
        <FeatureCard key={f.title} title={f.title} body={f.body} tile={f.tile} />
      ))}

      <Card center pad="32px">
        <p style={{ margin: '0 0 16px', fontSize: '19px', fontWeight: 700 }}>Not now? That is fine.</p>
        <Body>Everything you use today stays free. Reply to this email if you have a question and a person will answer.</Body>
        <Button href={ctaUrl}>See {planName}</Button>
      </Card>
    </CardEmail>
  )
}

function FeatureCard({ title, body, tile }: { title: string; body: string; tile: string }) {
  return (
    <>
      <Card>
        <FeatureRow title={title} body={body} tile={tile} />
      </Card>
      <CardGap />
    </>
  )
}
