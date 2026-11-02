import { Button, Card, CardEmail, Headline, Hero, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface MarketDigestRecruiterEmailProps {
  fullName: string
  specialty: string | null
  adzunaCount: number | null
  blsYoyChangePct: number | null
  nuggetTitle: string | null
  nuggetUrl: string | null
  nuggetSummary: string | null
  portalUrl: string
  unsubscribeUrl: string
}

export default function MarketDigestRecruiterEmail({
  fullName,
  specialty,
  adzunaCount,
  blsYoyChangePct,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  portalUrl,
  unsubscribeUrl,
}: MarketDigestRecruiterEmailProps) {
  return (
    <CardEmail
      preheader={`Here's this week's market read for ${specialty || 'your specialty'}.`}
      audience="recruiter"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Unsubscribe from the Weekly Market Digest
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Hi {fullName.split(' ')[0]}, here&apos;s this week&apos;s market read for {specialty || 'your specialty'}.
        </Headline>
        {adzunaCount !== null && (
          <Hero value={adzunaCount.toLocaleString()} caption="open roles currently match this specialty" />
        )}
        {blsYoyChangePct !== null && (
          <Lead>
            Employment in this field is {blsYoyChangePct >= 0 ? 'up' : 'down'}{' '}
            <strong>{Math.abs(blsYoyChangePct).toFixed(1)}%</strong> year over year.
          </Lead>
        )}
        {nuggetTitle && nuggetUrl && (
          <Lead>
            <strong>Worth a read:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
            {nuggetSummary && ` — ${nuggetSummary}`}
          </Lead>
        )}
        <Button href={portalUrl}>Go to your dashboard</Button>
      </Card>
    </CardEmail>
  )
}
