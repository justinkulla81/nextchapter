import type { JobSearchDailyContent, DailyItem, ScoreStatus } from '@/lib/job-search-daily/build'
import { Button, Card, CardEmail, CardGap, Headline, INK, MUTED, Wordmark } from '@/lib/email/card-layout'

interface JobSearchDailyEmailProps {
  content: JobSearchDailyContent
  masthead: string // "Job Search Daily", or a neutral name for Confidential Search Mode
  weekday: string // "Wednesday"
  appUrl: string
  unsubscribeUrl: string
}

// Card layout shared with the other NextChapter emails. Each part of the day
// (today, follow-ups, new jobs) gets its own white card; one green button.

const ink = INK
const muted = MUTED

const wordmarkSub: React.CSSProperties = {
  margin: '-20px 0 24px',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: muted,
}

const sub: React.CSSProperties = { color: muted, margin: '0 0 20px', fontSize: '16px' }

const block: React.CSSProperties = { margin: '0 0 22px', fontSize: '16px', lineHeight: '1.5', color: INK }
const label: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: muted,
  margin: '0 0 6px',
}
const list: React.CSSProperties = { margin: 0, paddingLeft: '20px' }
const li: React.CSSProperties = { margin: '4px 0' }
const itemLink: React.CSSProperties = {
  color: ink,
  textDecoration: 'underline',
  textDecorationColor: '#c9ced6',
}
const tail: React.CSSProperties = { color: muted }
const more: React.CSSProperties = {
  color: muted,
  fontSize: '14px',
  margin: '4px 0 0 20px',
}

const quoteStyle: React.CSSProperties = {
  margin: '24px 0 0',
  paddingTop: '16px',
  borderTop: '1px solid #eceef1',
  color: muted,
  fontStyle: 'italic',
  fontSize: '14px',
}

const STATUS: Record<ScoreStatus, { text: string; color: string }> = {
  locked: {
    text: 'A locked in. Anything else today is a bonus',
    color: '#2f855a',
  },
  onTrack: { text: 'On track for an A', color: '#2f855a' },
  behind: { text: 'A little behind. Today catches you up', color: '#b7791f' },
  atRisk: { text: 'Behind pace. Start with one to-do', color: '#c53030' },
}

const BAR: Record<ScoreStatus, string> = {
  locked: '#48bb78',
  onTrack: '#48bb78',
  behind: '#ecc94b',
  atRisk: '#f56565',
}

// A job's verdict reads like the board card's (job-card.ts), in plain words; the green stays on the button.
const verdictStyle: React.CSSProperties = { color: ink, fontWeight: 600 }
const whyStyle: React.CSSProperties = { display: 'block', color: muted, fontSize: '14px' }

function Bullet({ item }: { item: DailyItem }) {
  return (
    <li style={li}>
      {item.verdict && <span style={verdictStyle}>{item.verdict}: </span>}
      {item.href ? (
        <a href={item.href} style={itemLink}>
          {item.title}
        </a>
      ) : (
        item.title
      )}
      {item.detail && <span style={tail}> · {item.detail}</span>}
      {item.why && <span style={whyStyle}>{item.why}</span>}
    </li>
  )
}

function Section({ title, items, footerNote }: { title: string; items: DailyItem[]; footerNote?: React.ReactNode }) {
  if (items.length === 0) return null
  return (
    <div style={block}>
      <p style={label}>{title}</p>
      <ul style={list}>
        {items.map((item) => (
          <Bullet key={item.key} item={item} />
        ))}
      </ul>
      {footerNote}
    </div>
  )
}

export default function JobSearchDailyEmail({
  content,
  masthead,
  weekday,
  appUrl,
  unsubscribeUrl,
}: JobSearchDailyEmailProps) {
  const { score, priorities, todos, applications, networking, jobs, companyMoves, article, unlock, action, quote, fromProfile } =
    content
  const pct = score && score.target > 0 ? Math.min(100, Math.round((score.earned / score.target) * 100)) : 0
  const newForYou = [...jobs.items, ...companyMoves, ...(article ? [article] : [])]
  const followUpsUrl = `${appUrl}/dashboard/network/follow-ups?src=job_search_daily`

  const hasToday =
    priorities.length > 0 || !!fromProfile || content.whatChanged.length > 0 || !!content.checkIn || todos.length > 0
  const hasFollowUps = applications.length > 0 || networking.length > 0
  const hasJobs = jobs.fresh.length > 0 || content.likelyOpenings.length > 0 || newForYou.length > 0 || !!unlock

  return (
    <CardEmail
      preheader={`Your ${weekday} plan${score ? `: Weekly Search Score ${score.earned}/${score.target}` : ''}.`}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: muted }}>
          Turn off this email
        </a>
      }
    >
      <Card pad="28px 32px 12px">
        <Wordmark />
        <p style={wordmarkSub}>{masthead}</p>
        <Headline>Good morning, {content.firstName || 'there'}</Headline>
        <p style={sub}>
          Here&apos;s your {weekday}
          {content.dayNumber ? ` · Day ${content.dayNumber}` : ''}
          {content.streak >= 2 ? ` · ${content.streak}-day streak` : ''}
        </p>

        {score && (
          <div style={{ ...block, backgroundColor: '#e8f0f8', borderRadius: '20px', padding: '20px 24px' }}>
            <p style={{ margin: 0 }}>
              Weekly Search Score {score.earned}/{score.target}{' '}
              <span style={{ color: STATUS[score.status].color, fontWeight: 600 }}>{STATUS[score.status].text}</span>
            </p>
            <div
              style={{
                height: '8px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  height: '8px',
                  width: `${pct}%`,
                  backgroundColor: BAR[score.status],
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {hasToday && (
        <>
          <CardGap />
          <Card pad="28px 32px 6px">
            {priorities.length > 0 && (
              <div style={block}>
                <p style={label}>Top {priorities.length} today</p>
                <ul style={list}>
                  {priorities.map((p) => (
                    <li key={p.key} style={li}>
                      <strong>{p.lead}</strong>{' '}
                      <a href={p.href} style={itemLink}>
                        {p.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fromProfile && (
              <div style={block}>
                <p style={label}>From your profile</p>
                <p style={li}>
                  <strong>{fromProfile.title}.</strong>{' '}
                  {fromProfile.href ? (
                    <a href={fromProfile.href} style={itemLink}>
                      {fromProfile.detail}
                    </a>
                  ) : (
                    fromProfile.detail
                  )}
                </p>
              </div>
            )}

            {content.whatChanged.length > 0 && (
              <div style={block}>
                <p style={label}>What changed for you</p>
                <ul style={list}>
                  {content.whatChanged.map((line) => (
                    <li key={line} style={li}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {content.checkIn && (
              <div style={block}>
                <p style={label}>Weekly check-in</p>
                <p style={li}>Applied or reached out anywhere this week? Tap:</p>
                {content.checkIn.rows.map((row) => (
                  <p key={row.kind} style={li}>
                    <strong>{row.label}:</strong>{' '}
                    {row.taps.map((t, i) => (
                      <span key={t.label}>
                        {i > 0 && <span style={tail}> · </span>}
                        <a href={t.href} style={itemLink}>
                          {t.label}
                        </a>
                      </span>
                    ))}
                  </p>
                ))}
                <p style={more}>Counts toward Candidate+. Tapping again won&apos;t count twice.</p>
              </div>
            )}

            {todos.length > 0 && (
              <div style={block}>
                <p style={label}>{priorities.length > 0 ? 'Also to do' : 'To do today'}</p>
                <ul style={list}>
                  {todos.map((t, i) => (
                    <li key={i} style={li}>
                      {t.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}

      {hasFollowUps && (
        <>
          <CardGap />
          <Card pad="28px 32px 6px">
            <Section
              title="Follow up on applications"
              items={applications}
              footerNote={
                (content.applicationsMoreCount > 0 || content.staleApplicationCount > 0) && (
                  <p style={more}>
                    <a href={`${appUrl}/dashboard/find-my-job?src=job_search_daily`} style={{ color: muted }}>
                      {[
                        content.applicationsMoreCount > 0 ? 'See all' : null,
                        content.staleApplicationCount > 0 ? 'Mark older applications closed to keep your list clean' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </a>
                  </p>
                )
              }
            />

            <Section
              title="Follow up with people"
              items={networking}
              footerNote={
                content.networkingMoreCount > 0 && (
                  <p style={more}>
                    <a href={followUpsUrl} style={{ color: muted }}>
                      See everyone
                    </a>
                  </p>
                )
              }
            />
          </Card>
        </>
      )}

      {hasJobs && (
        <>
          <CardGap />
          <Card pad="28px 32px 6px">
            <Section title="Posted in the last 72 hours — apply first" items={jobs.fresh} />

            <Section title="Likely openings — not posted yet" items={content.likelyOpenings} />

            <Section title="New for you" items={newForYou} />

            {unlock && <Section title="Unlock next" items={[{ ...unlock, detail: null }]} />}
          </Card>
        </>
      )}

      <CardGap />
      <Card center pad="28px 32px 32px">
        <Button href={action.href}>{action.label}</Button>

        {quote && (
          <p style={{ ...quoteStyle, textAlign: 'left' }}>
            &ldquo;{quote.text}&rdquo; <span style={{ fontStyle: 'normal' }}>— {quote.author}</span>
          </p>
        )}
      </Card>
    </CardEmail>
  )
}
