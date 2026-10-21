import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ArmStat, CampaignResult, Recipient, Verdict } from '@/lib/outreach/report'

export const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '0%')
const REPLY_LABEL: Record<string, string> = { positive: 'Interested', referral: 'Pointed to someone', question: 'Question', no: 'Said no', other: 'Replied' }
const REPLY_TONE: Record<string, string> = { positive: 'bg-success/10 text-success', referral: 'bg-success/10 text-success', question: 'bg-brand/10 text-brand', no: 'bg-muted text-muted-foreground', other: 'bg-brand/10 text-brand' }
const STATE_TONE: Record<Verdict['state'], string> = { empty: 'bg-muted text-muted-foreground', early: 'bg-muted text-muted-foreground', leaning: 'bg-orange/15 text-navy', tied: 'bg-muted text-muted-foreground', winner: 'bg-success/10 text-success' }
const STATE_LABEL: Record<Verdict['state'], string> = { empty: 'Not started', early: 'Collecting data', leaning: 'Leaning', tied: 'Even', winner: 'Winner' }

export function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>
}

export function StatusChip({ verdict }: { verdict: Verdict }) {
  return <Chip tone={STATE_TONE[verdict.state]}>{STATE_LABEL[verdict.state]}</Chip>
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** A rate drawn as a bar, with the count beside it. */
export function RateBar({ label, count, of, tone = 'bg-navy/70' }: { label: string; count: number; of: number; tone?: string }) {
  const w = of ? Math.min(100, (100 * count) / of) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{count} of {of} · {pct(count, of)}</span></div>
      <div className="h-2 rounded-full bg-muted" aria-hidden><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(w, count ? 2 : 0)}%` }} /></div>
    </div>
  )
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{Math.round(value * 100)}%</span></div>
      <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(value * 100, 2)}%` }} /></div>
    </div>
  )
}

export function CampaignCard({ c }: { c: CampaignResult }) {
  return (
    <Link href={`/support/admin/crm/outreach/${c.def.slug}`} className="block rounded-2xl border border-border bg-white p-5 transition-colors hover:border-navy/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-semibold text-navy">{c.def.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{c.def.question}</p></div>
        <StatusChip verdict={c.verdict} />
      </div>
      <div className="mt-4 space-y-3">
        {[c.a, c.b].map((arm) => <RateBar key={arm.label} label={`${arm.label}: replies`} count={arm.replies} of={arm.sends} />)}
      </div>
      <p className="mt-4 text-sm"><span className="font-medium">{c.verdict.headline}.</span> <span className="text-muted-foreground">{c.verdict.detail}</span></p>
      <p className="mt-3 text-sm font-medium text-primary">See every email and reply →</p>
    </Link>
  )
}

export function ArmsTable({ arms, slug, active }: { arms: ArmStat[]; slug: string; active: string | null }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Group</th><th className="p-3">Emailed</th><th className="p-3">Replied</th><th className="p-3">Interested</th><th className="p-3">Clicked the link</th><th className="p-3">Opened again</th><th className="p-3">Bounced</th></tr></thead>
        <tbody>
          {arms.map((a) => (
            <tr key={a.label} className={`border-t border-border ${active === a.label ? 'bg-orange/5' : ''}`}>
              <td className="p-3 font-medium"><Link className="text-primary underline underline-offset-4" href={`/support/admin/crm/outreach/${slug}?arm=${encodeURIComponent(a.label)}`}>{a.label}</Link></td>
              <td className="p-3 tabular-nums">{a.sends}</td>
              <td className="p-3 tabular-nums">{a.replies} <span className="text-muted-foreground">({pct(a.replies, a.sends)})</span></td>
              <td className="p-3 tabular-nums">{a.positive}</td>
              <td className="p-3 tabular-nums">{a.clicks} <span className="text-muted-foreground">({pct(a.clicks, a.sends)})</span></td>
              <td className="p-3 tabular-nums">{a.reopens}</td>
              <td className="p-3 tabular-nums">{a.bounces}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** Every person emailed: who, where they work, which group, and what they did. Each name opens their CRM record. */
export function RecipientTable({ rows, showAudience = false }: { rows: Recipient[]; showAudience?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No one emailed yet.</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Contact</th><th className="p-3">Organization</th>{showAudience && <th className="p-3">Campaign</th>}<th className="p-3">Group</th><th className="p-3">Emailed</th><th className="p-3">What happened</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.personId} className="border-t border-border align-top">
              <td className="p-3"><Link href={`/support/admin/crm/people/${r.personId}`} className="font-medium text-primary underline underline-offset-4">{r.name}</Link><span className="block text-xs text-muted-foreground">{r.email}</span></td>
              <td className="p-3">{r.orgId ? <Link href={`/support/admin/crm/organizations/${r.orgId}`} className="text-primary underline underline-offset-4">{r.orgName}</Link> : r.orgName || <span className="text-muted-foreground">No organization</span>}</td>
              {showAudience && <td className="p-3">{r.audience}</td>}
              <td className="p-3">{r.arm}</td>
              <td className="p-3 whitespace-nowrap">{day(r.firstSentAt)}<span className="block text-xs text-muted-foreground">{r.steps === 1 ? 'First email' : `${r.steps} emails`}</span></td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {r.replyClass && <Chip tone={REPLY_TONE[r.replyClass]}>{REPLY_LABEL[r.replyClass]}{r.repliedAt ? `, ${day(r.repliedAt)}` : ''}</Chip>}
                  {r.clicked && <Chip tone="bg-success/10 text-success">Clicked the link</Chip>}
                  {r.humanOpens >= 2 && <Chip tone="bg-orange/15 text-navy">Opened {r.humanOpens} times</Chip>}
                  {r.bounced && <Chip tone="bg-destructive/10 text-destructive">Bounced</Chip>}
                  {!r.replyClass && !r.clicked && r.humanOpens < 2 && !r.bounced && <span className="text-muted-foreground">No response yet</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function HowToRead() {
  return (
    <details className="rounded-xl border border-border bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium">How to read these results</summary>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-muted-foreground">
        <li><b className="text-foreground">Replied</b> means the person wrote back within 14 days. Out-of-office replies are not counted.</li>
        <li><b className="text-foreground">Interested</b> is a reply that asks for the one-pager, a call or more information, or points us to someone else.</li>
        <li><b className="text-foreground">Clicked the link</b> counts only clicks after the first two minutes, because mail scanners click links within seconds.</li>
        <li><b className="text-foreground">Opened again</b> means opened more than once after the first two minutes. Opens are not a result, but repeat opens are worth a personal note.</li>
        <li><b className="text-foreground">Winner</b> appears only when the gap is too large to be chance. With small numbers, the leader changes from day to day, so the page says &quot;too early to call.&quot;</li>
      </ul>
    </details>
  )
}
