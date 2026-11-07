import { Body, Card, CardEmail, Headline, MUTED, Wordmark } from '@/lib/email/card-layout'
import { Button } from '@/lib/email/card-layout'

interface CandidateMatchLine {
  displayName: string
  roleTitle: string
  matchLabel: string
  locked: boolean
}

interface MarketDigestEmployerEmailProps {
  contactName: string | null
  companyName: string
  matchLines: CandidateMatchLine[]
  nuggetTitle: string | null
  nuggetUrl: string | null
  nuggetSummary: string | null
  portalUrl: string
  unsubscribeUrl: string
}

export default function MarketDigestEmployerEmail({
  contactName,
  companyName,
  matchLines,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  portalUrl,
  unsubscribeUrl,
}: MarketDigestEmployerEmailProps) {
  return (
    <CardEmail
      preheader={matchLines.length > 0 ? `${matchLines.length} matches for what you're hiring this week.` : 'Your Weekly Market Digest.'}
      audience="employer"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe from the Weekly Market Digest</a>}
    >
      <Card pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your Weekly Market Digest</Headline>
        <Body>Hi {contactName || `the ${companyName} team`},</Body>
        {matchLines.length > 0 && (
          <>
            <Body>Here&apos;s who&apos;s a match for what you&apos;re hiring this week.</Body>
            <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: '16px', lineHeight: '1.6' }}>
              {matchLines.map((m, i) => (
                <li key={`${m.roleTitle}-${i}`}>
                  {m.locked ? m.displayName : <strong>{m.displayName}</strong>} — {m.matchLabel} for {m.roleTitle}
                </li>
              ))}
            </ul>
          </>
        )}
        {nuggetTitle && nuggetUrl && (
          <Body>
            <strong>Worth a read:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
            {nuggetSummary && ` — ${nuggetSummary}`}
          </Body>
        )}
        <Button campaign="market_digest_employer" href={portalUrl}>See your matches →</Button>
      </Card>
    </CardEmail>
  )
}
