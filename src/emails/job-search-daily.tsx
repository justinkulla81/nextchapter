import type { JobSearchDailyContent, DailyItem, ScoreStatus } from '@/lib/job-search-daily/build'

interface JobSearchDailyEmailProps {
  content: JobSearchDailyContent
  masthead: string // "Job Search Daily", or a neutral name for Confidential Search Mode
  weekday: string // "Wednesday"
  appUrl: string
  unsubscribeUrl: string
}

// Layout borrowed from the best daily-digest emails: wordmark above a white
// card, a one-line greeting, bold-first bullets, and one colored button as
// the only pop of color. Short enough to read on a phone before coffee.

const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const ink = '#0b2545'
const muted = '#5a6472'
const accent = '#2e7d5b' // the action button only

const page: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  padding: '24px 12px',
  fontFamily: sans,
  color: '#111827',
  fontSize: '15px',
  lineHeight: '1.5',
}

const wordmark: React.CSSProperties = {
  textAlign: 'center',
  margin: '0 0 16px',
  fontSize: '22px',
  fontWeight: 800,
  color: ink,
  letterSpacing: '-0.02em',
}

const wordmarkSub: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: muted,
}

const card: React.CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '24px',
}

const hello: React.CSSProperties = { fontSize: '22px', fontWeight: 700, margin: 0, color: ink }
const sub: React.CSSProperties = { color: muted, margin: '4px 0 0' }

const label: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: ink, margin: '24px 0 4px' }
const list: React.CSSProperties = { margin: 0, paddingLeft: '20px' }
const li: React.CSSProperties = { margin: '4px 0' }
const itemLink: React.CSSProperties = { color: ink, fontWeight: 600, textDecoration: 'none' }
const tail: React.CSSProperties = { color: muted }
const more: React.CSSProperties = { color: muted, fontSize: '14px', margin: '4px 0 0 20px' }

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: accent,
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '999px',
  fontWeight: 700,
  fontSize: '16px',
  marginTop: '24px',
}

const quoteStyle: React.CSSProperties = {
  margin: '24px 0 0',
  paddingTop: '16px',
  borderTop: '1px solid #eceef1',
  color: muted,
  fontStyle: 'italic',
  fontSize: '14px',
}

const footer: React.CSSProperties = { textAlign: 'center', color: muted, fontSize: '12px', margin: '16px 0 0' }

const STATUS: Record<ScoreStatus, { text: string; color: string }> = {
  locked: { text: '🎉 A locked in', color: '#2f855a' },
  onTrack: { text: '💪 On track for an A', color: '#2f855a' },
  behind: { text: '⏳ A little behind. Today catches you up', color: '#b7791f' },
  atRisk: { text: '🚩 Behind pace. Start with one to-do', color: '#c53030' },
}

const BAR: Record<ScoreStatus, string> = {
  locked: '#48bb78',
  onTrack: '#48bb78',
  behind: '#ecc94b',
  atRisk: '#f56565',
}

function Bullet({ item }: { item: DailyItem }) {
  return (
    <li style={li}>
      {item.href ? (
        <a href={item.href} style={itemLink}>
          {item.title}
        </a>
      ) : (
        <strong>{item.title}</strong>
      )}
      {item.detail && <span style={tail}> · {item.detail}</span>}
    </li>
  )
}

function Section({ title, items, footerNote }: { title: string; items: DailyItem[]; footerNote?: React.ReactNode }) {
  if (items.length === 0) return null
  return (
    <>
      <p style={label}>{title}</p>
      <ul style={list}>
        {items.map((item) => (
          <Bullet key={item.key} item={item} />
        ))}
      </ul>
      {footerNote}
    </>
  )
}

export default function JobSearchDailyEmail({
  content,
  masthead,
  weekday,
  appUrl,
  unsubscribeUrl,
}: JobSearchDailyEmailProps) {
  const { score, todos, applications, networking, jobs, companyMoves, article, unlock, action, quote } = content
  const pct = score && score.target > 0 ? Math.min(100, Math.round((score.earned / score.target) * 100)) : 0
  const newForYou = [...jobs.items, ...companyMoves, ...(article ? [article] : [])]
  const followUpsUrl = `${appUrl}/dashboard/network/follow-ups?src=job_search_daily`

  return (
    <div style={page}>
      <p style={wordmark}>
        NextChapter
        <span style={wordmarkSub}>{masthead}</span>
      </p>

      <div style={card}>
        <p style={hello}>Hi {content.firstName || 'there'}!</p>
        <p style={sub}>
          Here&apos;s your {weekday}
          {content.dayNumber ? ` · Day ${content.dayNumber}` : ''}
          {content.streak >= 2 ? ` · 🔥 ${content.streak}-day streak` : ''}
        </p>

        {score && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: 0 }}>
              <strong>
                Weekly Search Score {score.earned}/{score.target}
              </strong>{' '}
              <span style={{ color: STATUS[score.status].color, fontWeight: 600 }}>{STATUS[score.status].text}</span>
            </p>
            <div style={{ height: '8px', backgroundColor: '#eceef1', borderRadius: '4px', marginTop: '8px' }}>
              <div
                style={{ height: '8px', width: `${pct}%`, backgroundColor: BAR[score.status], borderRadius: '4px' }}
              />
            </div>
          </div>
        )}

        {todos.length > 0 && (
          <>
            <p style={label}>✅ To do today</p>
            <ul style={list}>
              {todos.map((t, i) => (
                <li key={i} style={li}>
                  {t.text}
                </li>
              ))}
            </ul>
          </>
        )}

        <Section title={`📬 Follow up on applications (${applications.length})`} items={applications} />

        <Section
          title={`🤝 Follow up with people (${networking.length + content.networkingMoreCount})`}
          items={networking}
          footerNote={
            content.networkingMoreCount > 0 && (
              <p style={more}>
                <a href={followUpsUrl} style={{ color: muted }}>
                  +{content.networkingMoreCount} more
                </a>
              </p>
            )
          }
        />

        <Section
          title="✨ New for you"
          items={newForYou}
          footerNote={
            jobs.lockedCount > 0 && (
              <p style={more}>
                <a href={`${appUrl}/dashboard/find-my-job?src=job_search_daily`} style={{ color: muted }}>
                  +{jobs.lockedCount} more on the A-list board
                </a>
              </p>
            )
          }
        />

        {unlock && <Section title="🔓 Unlock next" items={[{ ...unlock, detail: null }]} />}

        <a href={action.href} style={button}>
          {action.label} →
        </a>

        {quote && (
          <p style={quoteStyle}>
            &ldquo;{quote.text}&rdquo; <span style={{ fontStyle: 'normal' }}>— {quote.author}</span>
          </p>
        )}
      </div>

      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: muted }}>
          Turn off this email
        </a>
      </p>
    </div>
  )
}
