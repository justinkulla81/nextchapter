import { emailStyles } from '@/lib/email/email-styles'
import type { JobSearchDailyContent, DailyItem } from '@/lib/job-search-daily/build'

interface JobSearchDailyEmailProps {
  content: JobSearchDailyContent
  masthead: string // "Job Search Daily", or a neutral name for Confidential Search Mode
  dateLabel: string
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  appUrl: string
  unsubscribeUrl: string
}

const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

const container: React.CSSProperties = {
  fontFamily: sans,
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const mastheadRow: React.CSSProperties = {
  borderBottom: '2px solid #0b2545',
  paddingBottom: '8px',
  width: '100%',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}
const dateStyle: React.CSSProperties = {
  ...emailStyles.muted,
  textAlign: 'right',
}

const line: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '19px',
  lineHeight: '1.45',
  margin: '24px 0 4px',
}

const signoff: React.CSSProperties = { ...emailStyles.muted, margin: 0 }

const scoreBox: React.CSSProperties = {
  marginTop: '16px',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#f4f6f4',
  fontSize: '15px',
}

const barTrack: React.CSSProperties = {
  height: '6px',
  backgroundColor: '#e5e7eb',
  borderRadius: '3px',
  marginTop: '8px',
}

const label: React.CSSProperties = {
  ...emailStyles.sectionLabel,
  margin: '32px 0 8px',
}

const todoList: React.CSSProperties = { paddingLeft: '20px', margin: 0 }
const todoItem: React.CSSProperties = { marginTop: '8px' }
const points: React.CSSProperties = {
  ...emailStyles.muted,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const itemRow: React.CSSProperties = {
  borderTop: '1px solid #e5e7eb',
  padding: '8px 0',
}
const itemTitle: React.CSSProperties = { fontWeight: 600, margin: 0 }
const itemDetail: React.CSSProperties = {
  ...emailStyles.muted,
  margin: '4px 0 0',
}
const link: React.CSSProperties = { color: '#2e7d5b' }

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '32px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = { ...emailStyles.muted, marginTop: '32px' }

function Item({ item }: { item: DailyItem }) {
  return (
    <div style={itemRow}>
      <p style={itemTitle}>
        {item.href ? (
          <a href={item.href} style={link}>
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </p>
      {item.detail && <p style={itemDetail}>{item.detail}</p>}
    </div>
  )
}

export default function JobSearchDailyEmail({
  content,
  masthead,
  dateLabel,
  victoriaName,
  appUrl,
  unsubscribeUrl,
}: JobSearchDailyEmailProps) {
  const { score, todos, jobs, companyMoves, layoff, reconnect, article } = content
  const newItems: DailyItem[] = [...companyMoves, ...(layoff ? [layoff] : []), ...(reconnect ? [reconnect] : [])]
  const pct = score && score.target > 0 ? Math.min(100, Math.round((score.earned / score.target) * 100)) : 0
  const toGo = score ? Math.max(0, score.target - score.earned) : 0

  return (
    <div style={container}>
      <table role="presentation" cellPadding={0} cellSpacing={0} style={mastheadRow}>
        <tbody>
          <tr>
            <td style={logo}>{masthead}</td>
            <td style={dateStyle}>
              {dateLabel}
              {content.dayNumber ? ` · Day ${content.dayNumber}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <p style={line}>{content.line.text}</p>
      <p style={signoff}>— {victoriaName}</p>

      {score && (
        <div style={scoreBox}>
          <strong>
            Weekly Search Score: {score.earned} / {score.target}
          </strong>
          {toGo > 0 ? ` · ${toGo} to an A` : ' · A locked in'}
          <div style={barTrack}>
            <div
              style={{
                height: '6px',
                width: `${pct}%`,
                backgroundColor: '#0b2545',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>
      )}

      {todos.length > 0 && (
        <>
          <p style={label}>Today&apos;s {todos.length}</p>
          <ol style={todoList}>
            {todos.map((t, i) => (
              <li key={i} style={todoItem}>
                {t.text} <span style={points}>+{t.points}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {(jobs.items.length > 0 || jobs.lockedCount > 0) && (
        <>
          <p style={label}>New roles that fit</p>
          {jobs.items.map((item) => (
            <Item key={item.key} item={item} />
          ))}
          {jobs.lockedCount > 0 && (
            <p style={itemDetail}>
              +{jobs.lockedCount} more on the A-list board.{' '}
              <a href={`${appUrl}/dashboard/find-my-job?src=job_search_daily`} style={link}>
                See how to unlock them
              </a>
            </p>
          )}
        </>
      )}

      {newItems.length > 0 && (
        <>
          <p style={label}>New since yesterday</p>
          {newItems.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </>
      )}

      {article && (
        <>
          <p style={label}>Worth 3 minutes</p>
          <Item item={article} />
        </>
      )}

      <a href={`${appUrl}/dashboard?src=job_search_daily`} style={button}>
        Open my dashboard
      </a>

      <p style={footer}>
        You get this every morning during an active search.{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off this email
        </a>
        .
      </p>
    </div>
  )
}
