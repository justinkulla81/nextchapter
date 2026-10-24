import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { outreachData, TIMING_NAME } from '@/lib/outreach/report'
import { CampaignCard, Chip, HowToRead, RecipientTable, Tile, pct } from '@/components/admin/OutreachParts'

export const maxDuration = 30

/** Admin → CRM → Outreach tests: every cold-email campaign, how each side is doing, and who has been emailed. */
export default async function OutreachPage() {
  await requireAdmin()
  const d = await outreachData()
  const t = d.totals

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cold outreach tests</h1>
        <p className="mt-1 text-muted-foreground">Cold email campaigns, each comparing two groups. Open a campaign to see every person emailed and what they did.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="People emailed" value={String(t.sent)} />
        <Tile label="Replied" value={String(t.replies)} sub={pct(t.replies, t.sent)} />
        <Tile label="Interested" value={String(t.positive)} sub="asked for more, or pointed us on" />
        <Tile label="Clicked the link" value={String(t.clicks)} sub={pct(t.clicks, t.sent)} />
        <Tile label="Warm, no reply" value={String(t.warm)} sub="clicked, or opened more than once" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{d.campaigns.map((c) => <CampaignCard key={c.def.slug} c={c} />)}</div>

      {d.timing.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Employer timing test: when to email after a layoff filing</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">When we emailed</th><th className="p-3">Emailed</th><th className="p-3">Replied</th><th className="p-3">Clicked the link</th></tr></thead>
              <tbody>{d.timing.map((x) => <tr key={x.key} className="border-t border-border"><td className="p-3 font-medium">{TIMING_NAME[x.key] ?? x.key}</td><td className="p-3 tabular-nums">{x.sends}</td><td className="p-3 tabular-nums">{x.replies} ({pct(x.replies, x.sends)})</td><td className="p-3 tabular-nums">{x.clicks} ({pct(x.clicks, x.sends)})</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Replies ({d.replies.length})</h2>
        {d.replies.length === 0 ? <p className="text-sm text-muted-foreground">No replies yet. They usually start arriving 2 to 3 days after the first emails.</p> : <RecipientTable rows={d.replies.slice(0, 15)} showAudience />}
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">Warm, no reply yet ({d.warm.length}) <Chip tone="bg-orange/15 text-navy">Worth a personal note</Chip></h2>
        {d.warm.length === 0 ? <p className="text-sm text-muted-foreground">No one yet. This lists people who clicked the link or opened an email more than once.</p> : <RecipientTable rows={d.warm} showAudience />}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Everyone emailed ({t.sent})</h2>
        <RecipientTable rows={d.recipients.slice(0, 100)} showAudience />
        {d.recipients.length > 100 && <p className="text-xs text-muted-foreground">Showing the latest 100. Open a campaign to see all of its recipients. <Link className="underline" href="/support/admin/crm/people">People</Link></p>}
      </div>

      <HowToRead />
    </div>
  )
}
