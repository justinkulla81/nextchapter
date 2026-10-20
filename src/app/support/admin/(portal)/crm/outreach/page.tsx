import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { outreachReport } from '@/lib/outreach/report'
import { Card, CardContent } from '@/components/ui/card'

export const maxDuration = 30

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-')
const verdict = (p: number) => (p < 0.05 ? 'real difference' : 'keep testing')
const TIMING_NAME: Record<string, string> = { T1: 'Right after (0 to 1 days)', T2: 'Delayed (about 14 days)', T3: 'Right before the effective date', T4: 'After the effective date' }

/** Admin → CRM → Outreach: how each cold-email test is doing, measured on replies and human clicks. */
export default async function OutreachPage() {
  await requireAdmin()
  const r = await outreachReport()
  const audiences = [...new Set(r.arms.map((a) => a.audience))]

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach tests</h1>
        <p className="mt-1 text-muted-foreground">
          Cold email, by audience and arm. The measures are replies (within 14 days) and clicks on the report link. A click in the first two minutes is a mail scanner and is not counted.
          Opens are not a result. {r.totalSent} first emails sent, {r.replies} replies ({pct(r.replies, r.totalSent)}), {r.clicks} real clicks ({pct(r.clicks, r.totalSent)}).
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Head to head</h2>
        {r.compares.map((c) => (
          <Card key={c.audience}>
            <CardContent className="space-y-1 pt-6">
              <p className="font-medium">{c.audience}: {c.label}</p>
              <p className="text-sm text-muted-foreground">{c.a} versus {c.b}</p>
              <p className="text-sm">Replies: {verdict(c.replyP)} (p={c.replyP.toFixed(2)}). Clicks: {verdict(c.clickP)} (p={c.clickP.toFixed(2)}).{c.need ? ` About ${c.need} sends per side to confirm a reply gap this size.` : ''}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {audiences.map((aud) => (
        <div key={aud} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{aud}</h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Arm</th><th className="p-2">Sent</th><th className="p-2">Replied</th><th className="p-2">Clicked</th><th className="p-2">Opened again</th><th className="p-2">Bounced</th></tr></thead>
              <tbody>
                {r.arms.filter((a) => a.audience === aud).map((a) => (
                  <tr key={a.variant} className="border-t border-border">
                    <td className="p-2 font-medium">{a.variant}</td><td className="p-2">{a.sends}</td>
                    <td className="p-2">{a.replies} ({pct(a.replies, a.sends)})</td><td className="p-2">{a.clicks} ({pct(a.clicks, a.sends)})</td>
                    <td className="p-2">{a.reopens}</td><td className="p-2">{a.bounces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {r.timing.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Timing test (employers, clean assignments)</h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Window</th><th className="p-2">Sent</th><th className="p-2">Replied</th><th className="p-2">Clicked</th></tr></thead>
              <tbody>{r.timing.map((t) => (<tr key={t.variant} className="border-t border-border"><td className="p-2 font-medium">{TIMING_NAME[t.variant] ?? t.variant}</td><td className="p-2">{t.sends}</td><td className="p-2">{t.replies} ({pct(t.replies, t.sends)})</td><td className="p-2">{t.clicks} ({pct(t.clicks, t.sends)})</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Warm, no reply yet ({r.warm.length})</h2>
        <p className="text-sm text-muted-foreground">Opened more than once after the first two minutes, or clicked the link. Worth a personal note.</p>
        {r.warm.length === 0 ? <p className="text-sm text-muted-foreground">No one yet.</p> : (
          <div className="space-y-1">
            {r.warm.map((w) => (
              <p key={w.personId} className="rounded-md border border-border px-3 py-2 text-sm">
                <Link href={`/support/admin/crm/people/${w.personId}`} className="font-medium text-primary underline underline-offset-4">{w.name}</Link>
                {w.org ? `, ${w.org}` : ''} · {w.email} · {w.humanOpens} later opens{w.clicked ? ', clicked' : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
