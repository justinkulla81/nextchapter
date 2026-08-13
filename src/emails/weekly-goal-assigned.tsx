import { emailStyles } from '@/lib/email/email-styles'
import type { Grade } from '@/lib/scoring/grade'

interface WeeklyGoalAssignedEmailProps {
  firstName: string | null
  introCopy?: string | null
  lastWeekPoints: number
  lastWeekTarget: number
  hitLastWeekTarget: boolean
  thisWeekTarget: number
  targetDelta: number
  grade: Grade
  gapSummary: string | null
  completedLastWeek: string[]
  thisWeekPlan: string[]
  dashboardUrl: string
  marketRealityReportUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
  fontSize: '15px',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const statBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#f5f5f0',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '20px',
  ...emailStyles.cta,
}

const benefitsList: React.CSSProperties = {
  paddingLeft: '20px',
  marginTop: '8px',
}

const winsBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#eaf4ef',
}

const planList: React.CSSProperties = {
  paddingLeft: '20px',
  marginTop: '8px',
  ...emailStyles.body,
  fontSize: '15px',
}

const secondaryLink: React.CSSProperties = {
  color: '#1d4e89',
  fontWeight: 600,
  textDecoration: 'none',
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

const A_GRADE_BENEFITS = [
  'Exclusive, A-List-only job postings on the NC Job Board',
  'Eligible to submit an Offer Bonus claim if you land a role',
  'Your Executive Dossier becomes shareable with recruiters and hiring managers',
  "You're surfaced to recruiters browsing the candidate database",
]

export default function WeeklyGoalAssignedEmail({
  firstName,
  introCopy,
  lastWeekPoints,
  lastWeekTarget,
  hitLastWeekTarget,
  thisWeekTarget,
  targetDelta,
  grade,
  gapSummary,
  completedLastWeek,
  thisWeekPlan,
  dashboardUrl,
  marketRealityReportUrl,
  unsubscribeUrl,
}: WeeklyGoalAssignedEmailProps) {
  const deltaCopy =
    targetDelta > 0
      ? `${targetDelta} more points than last week`
      : targetDelta < 0
        ? `${Math.abs(targetDelta)} fewer points than last week`
        : 'the same target as last week'

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        {firstName ? `Hi ${firstName} — ` : ''}your new week is set.
      </p>

      {introCopy && <p style={{ marginTop: '12px' }}>{introCopy}</p>}

      {completedLastWeek.length > 0 && (
        <div style={winsBox}>
          <p style={{ margin: 0, fontWeight: 600 }}>Look what you got done last week</p>
          <ul style={planList}>
            {completedLastWeek.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={statBox}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Last week: {lastWeekPoints} of {lastWeekTarget} points —{' '}
          {hitLastWeekTarget ? 'you hit the Weekly Sprint Target' : "you didn't hit the Weekly Sprint Target"}.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          This week&apos;s target: <strong>{thisWeekTarget} points</strong> ({deltaCopy}).
        </p>
      </div>

      <p style={{ marginTop: '20px', fontWeight: 600 }}>Your Search Plan this week:</p>
      {thisWeekPlan.length > 0 ? (
        <ul style={planList}>
          {thisWeekPlan.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: '4px' }}>
          Already picked for you and ready on your dashboard — no setup needed, just get started.
        </p>
      )}

      {grade === 'A' ? (
        <>
          <p style={{ marginTop: '20px', fontWeight: 600 }}>
            Your Current Market Reality is an A. That unlocks:
          </p>
          <ul style={benefitsList}>
            {A_GRADE_BENEFITS.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </>
      ) : (
        gapSummary && (
          <p style={{ marginTop: '20px' }}>
            <strong>Current Market Reality: {grade}.</strong> {gapSummary}
          </p>
        )
      )}

      <p style={{ marginTop: '12px' }}>
        <a href={marketRealityReportUrl} style={secondaryLink}>
          See your full Market Reality Report →
        </a>
      </p>

      <a href={dashboardUrl} style={button}>
        Let&apos;s go →
      </a>

      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these weekly emails
        </a>
      </p>
    </div>
  )
}
