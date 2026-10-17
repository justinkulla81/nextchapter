import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

/** One role, as the client's own board card says it (job-card.ts): verdict, meta line, why line. */
export interface CoachDigestJob {
  title: string
  company: string
  url: string
  /** "Strong fit" / "Good fit" / "Worth a look". */
  verdict: string
  /** "Posted 5 hours ago · Louisville, KY · Likely fewer applicants (search-firm listing)". */
  meta: string
  /** "Fits you: your level · finance — Gap: asks for SQL"; null when nothing specific is known. */
  why: string | null
}

export interface CoachDigestClient {
  name: string
  firstName: string
  weekNumber: number | null
  grade: string | null
  trend: 'up' | 'down' | 'flat' | null
  mood: string | null
  applications: number
  interviews: number
  offers: number
  outreach: number
  pointsThisWeek: number
  pointsLastWeek: number
  daysSinceActive: number | null
  attention: string[]
  goodNews: string[]
  newJobs: CoachDigestJob[]
  fullViewUrl: string
}

interface RoleMarketLine {
  roleType: string
  adzunaCount: number | null
}

interface MarketDigestCoachEmailProps {
  fullName: string
  clients: CoachDigestClient[]
  notSharedNames: string[]
  unavailableNames?: string[]
  roleLines: RoleMarketLine[]
  nuggetTitle: string | null
  nuggetUrl: string | null
  nuggetSummary: string | null
  caseloadUrl: string
  unsubscribeUrl: string
}

const NAVY = '#0b2545'
const GREEN = '#2e7d5b'
const RED = '#b42318'

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '600px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const card: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  marginTop: '16px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '24px',
  padding: '12px 20px',
  backgroundColor: GREEN,
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const label: React.CSSProperties = {
  ...emailStyles.sectionLabel,
  margin: '12px 0 4px',
}

const trendArrow = { up: '↑', down: '↓', flat: '→' } as const

export function coachDigestSummary(clients: CoachDigestClient[]) {
  return {
    needAttention: clients.filter((c) => c.attention.length > 0).length,
    newRoles: clients.reduce((sum, c) => sum + c.newJobs.length, 0),
    applications: clients.reduce((sum, c) => sum + c.applications, 0),
    interviews: clients.reduce((sum, c) => sum + c.interviews, 0),
  }
}

function activityLine(c: CoachDigestClient): string {
  const parts = [
    `${c.applications} application${c.applications === 1 ? '' : 's'}`,
    `${c.interviews} interview${c.interviews === 1 ? '' : 's'}`,
    `${c.outreach} outreach`,
  ]
  if (c.offers > 0) parts.push(`${c.offers} offer${c.offers === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function ClientCard({ c }: { c: CoachDigestClient }) {
  const quiet = c.applications === 0 && c.interviews === 0 && c.outreach === 0
  const delta = c.pointsThisWeek - c.pointsLastWeek
  return (
    <div style={card}>
      <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: NAVY }}>
        <a href={c.fullViewUrl} style={{ color: NAVY, textDecoration: 'none' }}>
          {c.name}
        </a>
      </p>
      <p style={{ ...emailStyles.muted, margin: '2px 0 0' }}>
        {[
          c.weekNumber ? `Week ${c.weekNumber}` : null,
          c.grade ? `Grade ${c.grade}${c.trend ? ` ${trendArrow[c.trend]}` : ''}` : null,
          c.mood ? `Feeling: ${c.mood}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {c.attention.length > 0 && (
        <>
          <p style={{ ...label, color: RED }}>Needs a conversation</p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {c.attention.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}

      {c.goodNews.length > 0 && (
        <>
          <p style={{ ...label, color: GREEN }}>Good news</p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {c.goodNews.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}

      <p style={label}>Their last 7 days</p>
      <p style={{ margin: 0 }}>
        {quiet ? `Nothing logged${c.daysSinceActive !== null ? ` — last active ${c.daysSinceActive} day${c.daysSinceActive === 1 ? '' : 's'} ago` : ''}.` : activityLine(c)}
      </p>
      <p style={{ ...emailStyles.muted, margin: '2px 0 0' }}>
        {c.pointsThisWeek} points this week
        {c.pointsLastWeek > 0 || c.pointsThisWeek > 0 ? ` (${delta >= 0 ? '+' : ''}${delta} vs last week)` : ''}
      </p>

      <p style={label}>New roles that fit {c.firstName}</p>
      {c.newJobs.length === 0 ? (
        <p style={{ ...emailStyles.muted, margin: 0 }}>No new roles that fit this week.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {c.newJobs.map((j) => (
            <li key={j.url} style={{ marginBottom: '6px' }}>
              <span style={{ color: NAVY, fontWeight: 600 }}>{j.verdict}: </span>
              <a href={j.url} style={{ color: NAVY, fontWeight: 600 }}>
                {j.title}
              </a>
              <br />
              <span style={emailStyles.muted}>{[j.company, j.meta].filter(Boolean).join(' · ')}</span>
              {j.why && (
                <>
                  <br />
                  <span style={emailStyles.muted}>{j.why.replace(/^Fits you:/, `Fits ${c.firstName}:`)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MarketDigestCoachEmail({
  fullName,
  clients,
  notSharedNames,
  unavailableNames = [],
  roleLines,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  caseloadUrl,
  unsubscribeUrl,
}: MarketDigestCoachEmailProps) {
  const s = coachDigestSummary(clients)
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: NAVY, margin: 0 }}>NextChapter</p>
      <p>Hi {fullName.split(' ')[0]},</p>
      {clients.length > 0 ? (
        <p>
          Your week at a glance:{' '}
          <strong>
            {s.needAttention} {s.needAttention === 1 ? 'client needs' : 'clients need'} a conversation
          </strong>
          , {s.applications} application{s.applications === 1 ? '' : 's'} and {s.interviews} interview
          {s.interviews === 1 ? '' : 's'} across your caseload, and{' '}
          <strong>
            {s.newRoles} new role{s.newRoles === 1 ? '' : 's'} that fit
          </strong>
          , worth sending.
        </p>
      ) : (
        <p>None of your clients have shared their profile with you yet, so there&apos;s no client detail to show this week.</p>
      )}

      {clients.map((c) => (
        <ClientCard key={c.fullViewUrl} c={c} />
      ))}

      {notSharedNames.length > 0 && (
        <p style={{ ...emailStyles.muted, marginTop: '16px' }}>
          Not shared with you yet, so no detail: {notSharedNames.join(', ')}. Ask them to turn on coach access in their
          privacy settings.
        </p>
      )}

      {unavailableNames.length > 0 && (
        <p style={{ ...emailStyles.muted, marginTop: '16px' }}>
          Couldn&apos;t load this week&apos;s detail for: {unavailableNames.join(', ')}. It will be back next week.
        </p>
      )}

      {roleLines.length > 0 && (
        <>
          <p style={{ ...label, marginTop: '28px' }}>Market, across your clients&apos; target roles</p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {roleLines.map((r) => (
              <li key={r.roleType}>
                {r.roleType}
                {r.adzunaCount !== null && ` — ${r.adzunaCount.toLocaleString()} open roles`}
              </li>
            ))}
          </ul>
        </>
      )}

      {nuggetTitle && nuggetUrl && (
        <p>
          <strong>What&apos;s working:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
          {nuggetSummary && ` — ${nuggetSummary}`}
        </p>
      )}

      <a href={caseloadUrl} style={button}>
        Open your caseload →
      </a>
      <p style={{ marginTop: '32px', ...emailStyles.muted }}>
        <a href={unsubscribeUrl}>Unsubscribe from the Weekly Market Digest</a>
      </p>
      <AudienceTag audience="coach" />
    </div>
  )
}
