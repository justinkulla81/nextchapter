import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getMailingSettings } from '@/lib/mailing/lists'
import { AUDIENCE_LABEL, type OutreachAudience } from '@/lib/warn/outreach/plan'
import { heldSummary, pendingCandidates } from '@/lib/warn/outreach/backfill'
import { BACKFILL_DAYS, BACKFILL_MIN_EMPLOYEES, NEW_DAYS, releaseTime } from '@/lib/warn/outreach/backfill-rules'
import { BackfillControls } from './BackfillControls'

export const dynamic = 'force-dynamic'

/** Admin → CRM → Mailing lists → Layoff outreach campaigns → Backfill: the layoffs the live sweep never emailed, drafted and held until you schedule them. */
export default async function BackfillPage() {
  await requireAdmin()
  const [pending, held, settings, sample] = await Promise.all([
    pendingCandidates(),
    heldSummary(),
    getMailingSettings(),
    prisma.mailingEdition.findMany({
      where: { campaign: 'layoff_outreach', status: 'DRAFT', createdByEmail: 'layoff-backfill' },
      select: { id: true, title: true, subject: true, audience: true, _count: { select: { recipients: { where: { excluded: false } } } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ])
  const at = releaseTime(new Date())
  const releaseLabel = at.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', hour: 'numeric', minute: '2-digit' }).replace(',', '') + ' ET'
  const hours = settings.ratePerHour > 0 ? Math.ceil(held.recipients / settings.ratePerHour) : null

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/mailing/campaigns" className="text-sm text-muted-foreground hover:underline">← Layoff outreach campaigns</Link>
        <h1 className="text-2xl font-semibold">Layoff outreach backfill</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          US layoffs of {BACKFILL_MIN_EMPLOYEES}+ people announced in the last {BACKFILL_DAYS} days that the live sweep never emailed, one per employer, biggest first.
          Announced {NEW_DAYS} days ago or less gets the standard email; older gets the continued-support wording. Drafting sends nothing:
          every email waits as a draft until you schedule it, and you can delete the drafts.
        </p>
      </header>

      <section aria-labelledby="state" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4"><h2 id="state" className="text-sm text-muted-foreground">Layoffs still to draft</h2><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{pending.length.toLocaleString('en-US')}</p></div>
        <div className="rounded-xl border border-border bg-white p-4"><h2 className="text-sm text-muted-foreground">Held emails</h2><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{held.editions.toLocaleString('en-US')}</p></div>
        <div className="rounded-xl border border-border bg-white p-4"><h2 className="text-sm text-muted-foreground">People who would get one</h2><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{held.recipients.toLocaleString('en-US')}</p></div>
      </section>

      <section aria-labelledby="mix" className="rounded-xl border border-border bg-white p-4 text-sm">
        <h2 id="mix" className="font-semibold text-navy">What is held</h2>
        {held.recipients === 0 ? (
          <p className="mt-2 text-muted-foreground">Nothing yet. Draft a batch to see who would get what.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Standard wording: {held.byMode.new.toLocaleString('en-US')} people. Continued-support wording: {held.byMode.older.toLocaleString('en-US')} people.</li>
            {Object.entries(held.byAudience).sort((a, b) => b[1] - a[1]).map(([a, n]) => (
              <li key={a}>{a in AUDIENCE_LABEL ? AUDIENCE_LABEL[a as OutreachAudience] : a}: {n.toLocaleString('en-US')}</li>
            ))}
            <li>The mailing tool sends 7 a.m. to 5 p.m. Eastern at {settings.ratePerHour}/hour, up to {settings.dailyCap}/day{hours ? `, so ${held.recipients.toLocaleString('en-US')} takes at least ${hours} hours of sending (more than one day when it is over the cap)` : ''}. Each person is emailed once.</li>
          </ul>
        )}
      </section>

      <section aria-labelledby="actions">
        <h2 id="actions" className="mb-3 text-lg font-semibold text-navy">Your move</h2>
        <BackfillControls held={{ editions: held.editions, recipients: held.recipients }} pending={pending.length} releaseLabel={releaseLabel} releasable={held.editions > 0} />
      </section>

      {sample.length > 0 && (
        <section aria-labelledby="sample">
          <h2 id="sample" className="mb-2 text-lg font-semibold text-navy">Latest held drafts</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {sample.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <span className="min-w-0"><span className="font-medium text-navy">{e.title}</span><span className="text-muted-foreground"> · {e.subject}</span></span>
                <span className="tabular-nums text-muted-foreground">{e._count.recipients} {e._count.recipients === 1 ? 'person' : 'people'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
