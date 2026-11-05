import { Button, Card, CardEmail, Headline, Hero, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface MarketDigestCandidateEmailProps {
  firstName: string | null
  introCopy: string | null
  adzunaCount: number | null
  adzunaIdealCount: number | null
  blsYoyChangePct: number | null
  nuggetTitle: string | null
  nuggetUrl: string | null
  nuggetSummary: string | null
  /** The article is one of our own tips (a page on this site), not an outside read. */
  nuggetIsTip?: boolean
  aiMarketText?: string | null
  dashboardUrl: string
  unsubscribeUrl: string
}

export default function MarketDigestCandidateEmail({
  firstName,
  introCopy,
  adzunaCount,
  adzunaIdealCount,
  blsYoyChangePct,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  nuggetIsTip,
  aiMarketText,
  dashboardUrl,
  unsubscribeUrl,
}: MarketDigestCandidateEmailProps) {
  return (
    <CardEmail
      preheader="Here's this week's market update for your target role."
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Unsubscribe from the Weekly Market Digest
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'}, here&apos;s this week&apos;s market update for your target role.</Headline>
        {adzunaIdealCount !== null && (
          <Hero
            value={adzunaIdealCount.toLocaleString()}
            caption="open roles match your target title, industry, and location"
          />
        )}
        {introCopy && <Lead>{introCopy}</Lead>}
        {adzunaIdealCount !== null && (
          <Lead>The closest read we have on what&apos;s realistically open to you right now.</Lead>
        )}
        {adzunaCount !== null && (
          <Lead>
            {adzunaIdealCount !== null ? 'A broader search on just your target title turns up ' : ''}
            <strong>{adzunaCount.toLocaleString()}</strong>{' '}
            open roles matching your target title{adzunaIdealCount !== null ? ' across any industry or location' : ' — a rough read on how active the market is right now'}.
          </Lead>
        )}
        {blsYoyChangePct !== null && (
          <Lead>
            Employment in this field is {blsYoyChangePct >= 0 ? 'up' : 'down'}{' '}
            <strong>{Math.abs(blsYoyChangePct).toFixed(1)}%</strong> year over year.
          </Lead>
        )}
        {aiMarketText && <Lead>{aiMarketText}</Lead>}
        {nuggetTitle && nuggetUrl && (
          <Lead>
            <strong>{nuggetIsTip ? 'Tip from NextChapter:' : 'Worth a read:'}</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
            {nuggetSummary && ` — ${nuggetSummary}`}
          </Lead>
        )}
        <Button campaign="market_digest" href={dashboardUrl}>Go to your dashboard</Button>
      </Card>
    </CardEmail>
  )
}
