interface Strength {
  title: string
  detail: string
}

interface SundayNightReportEmailProps {
  firstName: string | null
  isFirstWeek: boolean
  marketRealityGrade: string
  marketRealityLabel: string
  searchExecutionGrade: string | null // null when isFirstWeek
  searchExecutionLabel: string | null
  lastWeekCommittedCount: number
  lastWeekCompletedCount: number
  topStrength: Strength | null
  topWeakness: Strength | null
  straightTalk: string
  aStandardActions: string[]
  onAList: boolean
  aListCount: number
  reportUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#1d4e89',
  marginTop: '24px',
  marginBottom: '4px',
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
  fontWeight: 600,
  marginTop: '24px',
}

const footer: React.CSSProperties = {
  color: '#4a5568',
  fontSize: '13px',
  marginTop: '32px',
}

export default function SundayNightReportEmail({
  firstName,
  isFirstWeek,
  marketRealityGrade,
  marketRealityLabel,
  searchExecutionGrade,
  searchExecutionLabel,
  lastWeekCommittedCount,
  lastWeekCompletedCount,
  topStrength,
  topWeakness,
  straightTalk,
  aStandardActions,
  onAList,
  aListCount,
  reportUrl,
  unsubscribeUrl,
}: SundayNightReportEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'}, here&apos;s your week.</p>

      <p style={sectionLabel}>Your Hireability Grade</p>
      <p>
        Market Reality: <strong>{marketRealityGrade}</strong> ({marketRealityLabel})
        <br />
        Search Execution:{' '}
        {isFirstWeek ? (
          <strong>N/A — you haven&apos;t started your sprint yet</strong>
        ) : (
          <strong>
            {searchExecutionGrade} ({searchExecutionLabel})
          </strong>
        )}
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
