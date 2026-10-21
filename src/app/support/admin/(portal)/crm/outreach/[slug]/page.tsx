import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { outreachData } from '@/lib/outreach/report'
import { ArmsTable, HowToRead, Progress, RecipientTable, StatusChip } from '@/components/admin/OutreachParts'

export const maxDuration = 30

/** One campaign: the verdict in plain words, both sides, and every person emailed, filterable by side. */
export default async function OutreachCampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ arm?: string }> }) {
  await requireAdmin()
  const { slug } = await params
  const { arm } = await searchParams
  const d = await outreachData()
  const c = d.campaigns.find((x) => x.def.slug === slug)
  if (!c) notFound()
  const mine = d.recipients.filter((r) => r.campaign === slug)
  const active = [c.a.label, c.b.label].includes(arm ?? '') ? arm! : null
  const shown = active ? mine.filter((r) => r.arm === active) : mine
  const v = c.verdict

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <Link href="/support/admin/crm/outreach" className="text-sm text-primary underline underline-offset-4">All outreach tests</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{c.def.title}</h1><StatusChip verdict={v} /></div>
        <p className="mt-1 text-muted-foreground">{c.def.question}</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-white p-5">
        <p className="text-lg font-semibold text-navy">{v.headline}</p>
        <p className="text-sm text-muted-foreground">{v.detail}</p>
        <Progress value={v.progress} label={`Sample size: ${Math.min(c.a.sends, c.b.sends)} per side${v.needed ? ` of about ${v.needed} needed` : ''}`} />
        {v.technical && <p className="text-xs text-muted-foreground">For the statistically minded: {v.technical}.</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Both sides</h2>
        <ArmsTable arms={[c.a, c.b]} slug={slug} active={active} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <h2 className="font-medium text-muted-foreground">People emailed ({shown.length})</h2>
          <Link href={`/support/admin/crm/outreach/${slug}`} className={`rounded-full border px-3 py-1 ${active ? 'border-border' : 'border-navy bg-navy text-white'}`}>All</Link>
          {[c.a.label, c.b.label].map((l) => (
            <Link key={l} href={`/support/admin/crm/outreach/${slug}?arm=${encodeURIComponent(l)}`} className={`rounded-full border px-3 py-1 ${active === l ? 'border-navy bg-navy text-white' : 'border-border'}`}>{l}</Link>
          ))}
        </div>
        <RecipientTable rows={shown} />
      </div>

      <HowToRead />
    </div>
  )
}
