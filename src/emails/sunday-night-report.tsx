import { emailStyles } from '@/lib/email/email-styles'

interface Strength {
  title: string
  detail: string
}

interface MarketResponseSnapshot {
  outreachSent: number
  repliesReceived: number
  conversations: number
  referrals: number
  interviews: number
  offers: number
  paidProjectLeads: number
}

interface SundayNightReportEmailProps {
  firstName: string | null
  isFirstWeek: boolean
  marketRealityDescription: string
  searchExecutionDescription: string | null // null when isFirstWeek
  lastWeekCommittedCount: number
  lastWeekCompletedCount: number
  topStrength: Strength | null
  topWeakness: Strength | null
  straightTalk: string
  aStandardActions: string[]
  onAList: boolean
  aListCount: number
  marketResponse: MarketResponseSnapshot | null
  weekNumber: number
  reportUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const sectionLabel: React.CSSProperties = {
  marginTop: '24px',
  marginBottom: '4px',
  ...emailStyles.sectionLabel,
}

const straightTalkBox: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px',
  marginTop: '4px',
  fontWeight: 600,
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '24px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function SundayNightReportEmail({
  firstName,
  isFirstWeek,
  marketRealityDescription,
  searchExecutionDescription,
  lastWeekCommittedCount,
  lastWeekCompletedCount,
  topStrength,
  topWeakness,
  straightTalk,
  aStandardActions,
  onAList,
  aListCount,
  marketResponse,
  weekNumber,
  reportUrl,
  unsubscribeUrl,
}: SundayNightReportEmailProps) {
  const marketResponseAllZero =
    marketResponse !== null && Object.values(marketResponse).every((v) => v === 0)
  const replyRate =
    marketResponse && marketResponse.outreachSent > 0
      ? Math.round((marketResponse.repliesReceived / marketResponse.outreachSent) * 100)
      : null

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'}, here&apos;s your week.</p>

      <p style={sectionLabel}>Where You Stand</p>
      <p>
        <strong>Market position:</strong> {marketRealityDescription}
        <br />
        <strong>Search execution:</strong>{' '}
        {isFirstWeek
          ? "You haven't started your sprint yet — that's a starting line, not a grade."
          : searchExecutionDescription}
      </p>

      {!isFirstWeek && (
        <>
          <p style={sectionLabel}>Last Week</p>
          <p>
            You committed to {lastWeekCommittedCount} action{lastWeekCommittedCount === 1 ? '' : 's'} and completed{' '}
            {lastWeekCompletedCount}.
          </p>
        </>
      )}

      {(topStrength || topWeakness) && (
        <>
          {!isFirstWeek && marketResponse && (
        <>
          <p style={sectionLabel}>Market Response</p>
          <p>
            Separate from your Search Execution grade — this is whether the market is actually
            responding, not whether you did the work.
            <br />
            Outreach sent: <strong>{marketResponse.outreachSent}</strong> · Replies:{' '}
            <strong>
              {marketResponse.repliesReceived}
              {replyRate !== null && ` (${replyRate}%)`}
            </strong>{' '}
            · Conversations: <strong>{marketResponse.conversations}</strong> · Referrals:{' '}
            <strong>{marketResponse.referrals}</strong> · Interviews:{' '}
            <strong>{marketResponse.interviews}</strong> · Offers: <strong>{marketResponse.offers}</strong>
            {marketResponse.paidProjectLeads > 0 && (
              <>
                {' '}
                · Paid-project leads: <strong>{marketResponse.paidProjectLeads}</strong>
              </>
            )}
          </p>
          {marketResponseAllZero && weekNumber <= 3 && (
            <p>
              No external signals yet — that&apos;s normal at week {weekNumber}. By week 4, we want
              to see at least one reply or conversation.
            </p>
          )}
          {marketResponseAllZero && weekNumber >= 4 && (
            <p style={{ fontWeight: 600 }}>
              Still no external signals despite real weeks of effort — worth naming honestly: this
              is no longer about doing more, it&apos;s about what to change.
            </p>
          )}
        </>
      )}

      <p style={sectionLabel}>Strengths &amp; Weaknesses</p>
          {topStrength && (
            <p>
              <strong>{topStrength.title}</strong> — {topStrength.detail}
            </p>
          )}
          {topWeakness && (
            <p>
              <strong>{topWeakness.title}</strong> — {topWeakness.detail}
            </p>
          )}
        </>
      )}

      <p style={sectionLabel}>Straight Talk</p>
      <div style={straightTalkBox}>{straightTalk}</div>

      {aStandardActions.length > 0 && (
        <>
          <p style={sectionLabel}>To Earn Your A This Week</p>
          <p>{aStandardActions.join(' · ')}</p>
        </>
      )}

      <p style={sectionLabel}>The A-List</p>
      <p>
        {onAList
          ? "You're on this week's A-List. You earned it. — Victoria"
          : `${aListCount} member${aListCount === 1 ? '' : 's'} earned their A this week. You can make next week's list.`}
      </p>

      <a href={reportUrl} style={button}>
        Read your full report
      </a>

      <p style={footer}>
        Don&apos;t want weekly reports?{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn them off
        </a>
        .
      </p>
    </div>
  )
}
