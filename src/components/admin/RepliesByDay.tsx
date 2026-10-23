import Link from 'next/link'
import type { SentEmailRow } from '@/lib/crm/sent-emails'
import type { SentDay } from '@/components/admin/SentEmailsChart'
import { Chip } from '@/components/admin/OutreachParts'
import { SOURCE_LABEL } from '@/lib/crm/sent-emails'

const REPLY_LABEL: Record<string, string> = { positive: 'Interested', referral: 'Pointed to someone', question: 'Question', no: 'Said no', other: 'Replied' }
const REPLY_TONE: Record<string, string> = { positive: 'bg-success/10 text-success', referral: 'bg-success/10 text-success', question: 'bg-brand/10 text-brand', no: 'bg-muted text-muted-foreground', other: 'bg-muted text-muted-foreground' }
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
const heading = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
const hoursToReply = (r: SentEmailRow) => (r.repliedAt ? Math.max(0, Math.round((r.repliedAt.getTime() - r.sentAt.getTime()) / 3_600_000)) : null)
const after = (h: number) => (h < 1 ? 'within the hour' : h < 48 ? `${h}h later` : `${Math.round(h / 24)} days later`)

/** The replies behind each bar of the chart: for each day emails went out, who answered and what kind of answer it was. */
export function RepliesByDay({ rows, days }: { rows: SentEmailRow[]; days: SentDay[] }) {
  const replied = rows.filter((r) => r.repliedAt)
  const byDay = new Map<string, SentEmailRow[]>()
  for (const r of replied) {
    const k = dayKey.format(r.sentAt)
    byDay.set(k, [...(byDay.get(k) ?? []), r])
  }
  const shown = days.filter((d) => byDay.has(d.date)).reverse()
  const older = replied.length - shown.reduce((n, d) => n + (byDay.get(d.date)?.length ?? 0), 0)

  return (
    <section className="space-y-3 rounded-xl border border-border bg-white p-4" aria-labelledby="replies-heading">
      <div>
        <h2 id="replies-heading" className="text-sm font-medium text-muted-foreground">Replies, by the day the email was sent</h2>
        <p className="text-xs text-muted-foreground">Each day is one bar of the chart. Click a bar marked with ↩ to jump to its replies. Out-of-office messages are not counted.</p>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet to the emails on this chart.</p>
      ) : (
        <div className="space-y-5">
          {shown.map((d) => {
            const list = [...(byDay.get(d.date) ?? [])].sort((a, b) => (a.repliedAt!.getTime() - b.repliedAt!.getTime()))
            const sent = d.cold + d.crm + d.gmail + d.mailing
            return (
              <div key={d.date} id={`replies-${d.date}`} className="scroll-mt-24">
                <h3 className="text-sm font-semibold">
                  {heading(d.date)} <span className="font-normal text-muted-foreground">· {sent} sent · {list.length} {list.length === 1 ? 'reply' : 'replies'}</span>
                </h3>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {list.map((r) => {
                    const h = hoursToReply(r)
                    return (
                      <li key={r.key} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0 space-y-0.5">
                          <p>
                            {r.personId ? <Link href={`/support/admin/crm/people/${r.personId}`} className="font-medium text-navy hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                            {r.orgId ? <> · <Link href={`/support/admin/crm/organizations/${r.orgId}`} className="text-muted-foreground hover:underline">{r.orgName}</Link></> : null}
                          </p>
                          <p className="line-clamp-1 text-muted-foreground">{r.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {SOURCE_LABEL[r.source]} · replied {when.format(r.repliedAt!)}{h != null ? `, ${after(h)}` : ''}
                            {r.externalUrl ? <> · <a href={r.externalUrl} target="_blank" rel="noreferrer" className="text-primary underline">{r.source === 'gmail' || r.source === 'crm' ? 'Open in Gmail' : 'Open in Resend'}</a></> : null}
                          </p>
                        </div>
                        <Chip tone={REPLY_TONE[r.replyClass ?? 'other'] ?? REPLY_TONE.other}>{REPLY_LABEL[r.replyClass ?? 'other'] ?? 'Replied'}</Chip>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {older > 0 && <p className="text-xs text-muted-foreground">{older} more {older === 1 ? 'reply' : 'replies'} to emails sent before the first day on this chart.</p>}
        </div>
      )}
    </section>
  )
}
