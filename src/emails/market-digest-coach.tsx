import { Fragment } from 'react'
import { Button, Card, CardEmail, CardGap, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

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

const muted: React.CSSProperties = { fontSize: '14px', lineHeight: '1.5', color: MUTED }

const label: React.CSSProperties = {
  margin: '16px 0 4px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: MUTED,
}

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: '18px', fontSize: '16px', lineHeight: '1.5', color: INK }

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
    <div style={{ textAlign: 'left' }}>
      <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: NAVY }}>
        <a href={c.fullViewUrl} style={{ color: NAVY, textDecoration: 'none' }}>
          {c.name}
        </a>
      </p>
      <p style={{ ...muted, margin: '2px 0 0' }}>
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
          <ul style={listStyle}>
            {c.attention.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}

      {c.goodNews.length > 0 && (
        <>
          <p style={{ ...label, color: GREEN }}>Good news</p>
          <ul style={listStyle}>
            {c.goodNews.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}

      <p style={label}>Their last 7 days</p>
      <p style={{ margin: 0, fontSize: '16px', color: INK }}>
        {quiet ? `Nothing logged${c.daysSinceActive !== null ? ` — last active ${c.daysSinceActive} day${c.daysSinceActive === 1 ? '' : 's'} ago` : ''}.` : activityLine(c)}
      </p>
      <p style={{ ...muted, margin: '2px 0 0' }}>
        {c.pointsThisWeek} points this week
        {c.pointsLastWeek > 0 || c.pointsThisWeek > 0 ? ` (${delta >= 0 ? '+' : ''}${delta} vs last week)` : ''}
      </p>

      <p style={label}>New roles that fit {c.firstName}</p>
      {c.newJobs.length === 0 ? (
        <p style={{ ...muted, margin: 0 }}>No new roles that fit this week.</p>
      ) : (
        <ul style={listStyle}>
          {c.newJobs.map((j) => (
            <li key={j.url} style={{ marginBottom: '6px' }}>
              <span style={{ color: NAVY, fontWeight: 600 }}>{j.verdict}: </span>
              <a href={j.url} style={{ color: NAVY, fontWeight: 600 }}>
                {j.title}
              </a>
              <br />
              <span style={muted}>{[j.company, j.meta].filter(Boolean).join(' · ')}</span>
              {j.why && (
                <>
                  <br />
                  <span style={muted}>{j.why.replace(/^Fits you:/, `Fits ${c.firstName}:`)}</span>
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
  const hasExtras = notSharedNames.length > 0 || unavailableNames.length > 0 || roleLines.length > 0 || (nuggetTitle && nuggetUrl)
  return (
    <CardEmail
      preheader="Your week at a glance across your caseload."
      audience="coach"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Unsubscribe from the Weekly Market Digest
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your week at a glance</Headline>
        {clients.length > 0 ? (
          <Lead>
            Hi {fullName.split(' ')[0]}.{' '}
            <strong>
              {s.needAttention} {s.needAttention === 1 ? 'client needs' : 'clients need'} a conversation
            </strong>
            , {s.applications} application{s.applications === 1 ? '' : 's'} and {s.interviews} interview
            {s.interviews === 1 ? '' : 's'} across your caseload, and{' '}
            <strong>
              {s.newRoles} new role{s.newRoles === 1 ? '' : 's'} that fit
            </strong>
            , worth sending.
          </Lead>
        ) : (
          <Lead>
            Hi {fullName.split(' ')[0]}. None of your clients have shared their profile with you yet, so there&apos;s no client detail to show this
            week.
          </Lead>
        )}
        <Button href={caseloadUrl}>Open your caseload</Button>
      </Card>

      {clients.map((c) => (
        <Fragment key={c.fullViewUrl}>
          <CardGap />
          <Card>
            <ClientCard c={c} />
          </Card>
        </Fragment>
      ))}

      {hasExtras && (
        <>
          <CardGap />
          <Card>
            <div style={{ textAlign: 'left' }}>
              {notSharedNames.length > 0 && (
                <p style={{ ...muted, margin: '0 0 12px' }}>
                  Not shared with you yet, so no detail: {notSharedNames.join(', ')}. Ask them to turn on coach access in their
                  privacy settings.
                </p>
              )}

              {unavailableNames.length > 0 && (
                <p style={{ ...muted, margin: '0 0 12px' }}>
                  Couldn&apos;t load this week&apos;s detail for: {unavailableNames.join(', ')}. It will be back next week.
                </p>
              )}

              {roleLines.length > 0 && (
                <>
                  <p style={{ ...label, marginTop: 0 }}>Market, across your clients&apos; target roles</p>
                  <ul style={listStyle}>
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
                <p style={{ margin: '16px 0 0', fontSize: '16px', lineHeight: '1.6', color: INK }}>
                  <strong>What&apos;s working:</strong> <a href={nuggetUrl} style={{ color: NAVY }}>{nuggetTitle}</a>
                  {nuggetSummary && ` — ${nuggetSummary}`}
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </CardEmail>
  )
}
