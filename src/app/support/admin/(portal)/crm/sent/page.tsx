import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadSentEmails, totalsOf, SOURCE_LABEL, SOURCE_CAP, type SentEmailRow, type SentSource } from '@/lib/crm/sent-emails'
import { Chip, Tile, pct } from '@/components/admin/OutreachParts'
import { SentEmailsChart, type SentDay } from '@/components/admin/SentEmailsChart'
import { RepliesByDay } from '@/components/admin/RepliesByDay'

export const maxDuration = 60

const PAGE_SIZE = 50
const ENGAGEMENT = { all: 'Any result', opened: 'Opened', clicked: 'Clicked a link', replied: 'Replied', bounced: 'Bounced', quiet: 'No open or reply' } as const
type Engagement = keyof typeof ENGAGEMENT

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
const REPLY_LABEL: Record<string, string> = { positive: 'Interested', referral: 'Pointed to someone', question: 'Question', no: 'Said no', other: 'Replied' }

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const MAX_CHART_DAYS = 90

/** One bar per Eastern-time day from the first send to today (at most 90 days), zero-filled, counted by kind. */
function perDay(rows: SentEmailRow[]): SentDay[] {
  if (!rows.length) return []
  const by = new Map<string, SentDay>()
  for (const r of rows) {
    const k = dayKey.format(r.sentAt)
    const d = by.get(k) ?? { date: k, cold: 0, crm: 0, gmail: 0, mailing: 0, replies: 0 }
    d[r.source]++
    if (r.repliedAt) d.replies = (d.replies ?? 0) + 1
    by.set(k, d)
  }
  const out: SentDay[] = []
  const end = new Date(`${dayKey.format(new Date())}T12:00:00Z`)
  const first = new Date(`${[...by.keys()].sort()[0]}T12:00:00Z`)
  const start = new Date(Math.max(first.getTime(), end.getTime() - (MAX_CHART_DAYS - 1) * 86_400_000))
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const k = new Date(t).toISOString().slice(0, 10)
    out.push(by.get(k) ?? { date: k, cold: 0, crm: 0, gmail: 0, mailing: 0, replies: 0 })
  }
  return out
}

function matches(r: SentEmailRow, e: Engagement, q: string) {
  if (e === 'opened' && !(r.tracked && r.opens > 0)) return false
  if (e === 'clicked' && !(r.tracked && r.clicks > 0)) return false
  if (e === 'replied' && !r.repliedAt) return false
  if (e === 'bounced' && !r.bounced) return false
  if (e === 'quiet' && (!r.tracked || r.opens > 0 || r.repliedAt || r.bounced)) return false
  if (q) {
    const hay = `${r.name} ${r.email} ${r.orgName} ${r.subject} ${r.purpose} ${r.lists.map((l) => l.name).join(' ')}`.toLowerCase()
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
  }
  return true
}

/** Admin → CRM → Sent email: every email we have sent, with who got it, why, and what they did. */
export default async function SentEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? ''
  const source = (['cold', 'crm', 'gmail', 'mailing'] as const).find((s) => s === one('source')) ?? null
  const engagement = (Object.keys(ENGAGEMENT) as Engagement[]).find((e) => e === one('result')) ?? 'all'
  const q = one('q').trim().slice(0, 100)
  const page = Math.max(1, Number.parseInt(one('page'), 10) || 1)

  const { rows: all, capped } = await loadSentEmails()
  const days = perDay(all)
  const inSource = source ? all.filter((r) => r.source === source) : all
  const t = totalsOf(inSource)
  const shown = inSource.filter((r) => matches(r, engagement, q))
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const slice = shown.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  captureServerEvent(admin.email ?? 'admin', 'crm_sent_emails_viewed', { source: source ?? 'all', result: engagement, hasQuery: !!q, page: cur, matched: shown.length })

  const href = (p: number) => {
    const u = new URLSearchParams()
    if (source) u.set('source', source)
    if (engagement !== 'all') u.set('result', engagement)
    if (q) u.set('q', q)
    if (p > 1) u.set('page', String(p))
    const s = u.toString()
    return `/support/admin/crm/sent${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sent email</h1>
        <p className="mt-1 text-muted-foreground">Every email we have sent from the CRM, cold outreach, Gmail and mailing lists, with who got it, why it went out, and what they did.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Emails sent" value={t.sent.toLocaleString()} sub={source ? SOURCE_LABEL[source] : 'All sources'} />
        <Tile label="Opened" value={t.opened.toLocaleString()} sub={t.tracked ? `${pct(t.opened, t.tracked)} of ${t.tracked.toLocaleString()} tracked` : 'No tracked email here'} />
        <Tile label="Clicked a link" value={t.clicked.toLocaleString()} sub={t.tracked ? pct(t.clicked, t.tracked) : undefined} />
        <Tile label="Replied" value={t.replied.toLocaleString()} sub={`${pct(t.replied, t.sent)} · ${t.positive} interested`} />
        <Tile label="Bounced" value={t.bounced.toLocaleString()} sub={pct(t.bounced, t.sent)} />
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-white p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Emails sent per day, by kind</h2>
        <SentEmailsChart days={days} />
      </div>

      <RepliesByDay rows={all} days={days} />

      <form method="get" action="/support/admin/crm/sent" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4">
        <label className="space-y-1 text-xs text-muted-foreground">Source
          <select name="source" defaultValue={source ?? ''} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground">
            <option value="">All sources</option>
            {(Object.keys(SOURCE_LABEL) as SentSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">What they did
          <select name="result" defaultValue={engagement} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground">
            {(Object.keys(ENGAGEMENT) as Engagement[]).map((e) => <option key={e} value={e}>{ENGAGEMENT[e]}</option>)}
          </select>
        </label>
        <label className="min-w-56 flex-1 space-y-1 text-xs text-muted-foreground">Search
          <input name="q" defaultValue={q} placeholder="Person, organization, subject or mailing list" className="block w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
        </label>
        <button type="submit" className="rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">Apply filters</button>
        {(source || engagement !== 'all' || q) && <Link href="/support/admin/crm/sent" className="py-1.5 text-sm text-muted-foreground underline">Clear filters</Link>}
      </form>

      {capped.length > 0 && (!source || capped.includes(source)) && (
        <p className="rounded-md bg-orange/10 px-3 py-2 text-sm text-navy">Showing the latest {SOURCE_CAP.toLocaleString()} emails per source ({capped.map((s) => SOURCE_LABEL[s]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}). Older sends are not listed here.</p>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{shown.length.toLocaleString()} email{shown.length === 1 ? '' : 's'}{shown.length > PAGE_SIZE ? ` · page ${cur} of ${pages}` : ''}</p>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">No sent email matches these filters. Clear them to see everything.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Sent</th><th className="p-3">To</th><th className="p-3">Email</th><th className="p-3">Why it was sent</th><th className="p-3">Opens</th><th className="p-3">Clicks</th><th className="p-3">Reply</th></tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.key} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{fmt.format(r.sentAt)}</td>
                    <td className="p-3">
                      {r.personId ? <Link href={`/support/admin/crm/people/${r.personId}`} className="font-medium text-navy hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                      {r.email && r.email !== r.name && <p className="text-xs text-muted-foreground">{r.email}</p>}
                      {r.orgId && <Link href={`/support/admin/crm/organizations/${r.orgId}`} className="text-xs text-muted-foreground hover:underline">{r.orgName}</Link>}
                    </td>
                    <td className="max-w-xs p-3">
                      <p className="line-clamp-2 font-medium">{r.subject}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Chip tone="bg-muted text-muted-foreground">{SOURCE_LABEL[r.source]}</Chip>
                        {r.externalUrl && <a href={r.externalUrl} target="_blank" rel="noreferrer" className="text-primary underline">{r.source === 'gmail' || r.source === 'crm' ? 'Open in Gmail' : 'Open in Resend'}</a>}
                      </div>
                    </td>
                    <td className="p-3">
                      <p>{r.purpose}</p>
                      {r.campaign && <Link href={`/support/admin/crm/outreach/${r.campaign.slug}`} className="text-xs text-primary underline">A/B test: {r.campaign.title}</Link>}
                      {r.edition && <Link href={`/support/admin/crm/mailing/editions/${r.edition.id}`} className="text-xs text-primary underline">Open edition</Link>}
                      {r.lists.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1 text-xs">
                          {r.lists.map((l) => <Link key={l.id} href={`/support/admin/crm/mailing/lists/${l.id}`} className="rounded-full bg-brand/10 px-2 py-0.5 text-brand hover:underline">{l.name}</Link>)}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 tabular-nums">{r.tracked ? (r.opens > 0 ? <span className="text-success">{r.opens}×</span> : r.scannerOpenOnly ? <span className="text-muted-foreground" title="Opened within two minutes of sending: almost always a security scanner at the recipient's company, not a person">Scanner only</span> : <span className="text-muted-foreground">0</span>) : <span className="text-muted-foreground" title="Email sent from Gmail has no open tracking">Not tracked</span>}</td>
                    <td className="whitespace-nowrap p-3 tabular-nums">{r.tracked ? (r.clicks > 0 ? <span className="text-success">{r.clicks}</span> : <span className="text-muted-foreground">0</span>) : <span className="text-muted-foreground">Not tracked</span>}</td>
                    <td className="p-3">
                      {r.repliedAt ? (
                        <div className="space-y-0.5">
                          <Chip tone="bg-success/10 text-success">{REPLY_LABEL[r.replyClass ?? 'other'] ?? 'Replied'}</Chip>
                          <p className="text-xs text-muted-foreground">{fmt.format(r.repliedAt)}</p>
                        </div>
                      ) : r.bounced ? <Chip tone="bg-muted text-muted-foreground">Bounced</Chip> : r.failed ? <Chip tone="bg-muted text-muted-foreground">Failed to send</Chip> : <span className="text-muted-foreground">No reply</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            {cur > 1 ? <Link href={href(cur - 1)} className="text-primary underline">← Newer</Link> : <span />}
            {cur < pages ? <Link href={href(cur + 1)} className="text-primary underline">Older →</Link> : <span />}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Opens and clicks are tracked for cold outreach, email composed in the CRM and mailing lists. Email you send straight from Gmail carries no tracking, so only replies show. Replies are matched by conversation, and out-of-office messages are not counted. Counts here are per email, so a person who got three emails appears three times.
      </p>
    </div>
  )
}
