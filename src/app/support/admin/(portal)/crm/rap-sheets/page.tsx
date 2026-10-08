import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { RapSheetDecision, RapSheetGenerateButton } from '@/components/admin/RapSheetControls'

export const maxDuration = 30

const STATUS_LABEL: Record<string, string> = {
  OFFERED: 'Waiting on you', APPROVED: 'Included — arrives 6:30 AM ET', SKIPPED: 'Skipped', READY: 'Built', FAILED: 'Failed',
}
const when = (d: Date | null) => (d ? d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'No meeting time')

export default async function RapSheetsPage() {
  await requireAdmin()
  const horizon = new Date()
  horizon.setHours(horizon.getHours() - 36)
  const sheets = await prisma.crmRapSheet.findMany({
    where: { OR: [{ meetingAt: { gte: horizon } }, { meetingAt: null, createdAt: { gte: horizon } }, { status: 'READY' }] },
    orderBy: [{ meetingAt: 'asc' }], take: 60,
    include: { person: { select: { id: true, fullName: true, affiliations: { select: { org: { select: { name: true } } }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1 } } } },
  })
  const upcoming = sheets.filter((s) => !s.meetingAt || s.meetingAt >= horizon)

  return (
    <div className="space-y-6">
      <nav className="text-sm"><Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← Ecosystem</Link></nav>
      <header>
        <h1 className="text-2xl font-semibold">Rap sheets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The night before, you get an email listing tomorrow&apos;s pitches. Include the ones you want a rap sheet for; each one is
          researched fresh (about $0.30–1.00) and emailed at 6:30 AM ET. Anything you leave alone is skipped.
        </p>
      </header>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pitches offered yet. Open a person in the CRM and choose &ldquo;Build rap sheet now&rdquo; for a one-off.</p>
      ) : (
        <ul className="divide-y rounded border">
          {upcoming.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <Link href={`/support/admin/crm/people/${s.person.id}`} className="font-medium underline">{s.person.fullName}</Link>
                {s.person.affiliations[0] && <span className="text-sm text-muted-foreground">, {s.person.affiliations[0].org.name}</span>}
                <p className="text-sm text-muted-foreground">{when(s.meetingAt)}{s.meetingTitle ? ` · ${s.meetingTitle}` : ''} · {STATUS_LABEL[s.status]}{s.emailedAt ? ' · emailed' : ''}</p>
                {s.error && <p className="text-sm text-red-700">{s.error}</p>}
                {s.content && <Link href={`/support/admin/crm/rap-sheets/${s.id}`} className="text-sm underline">View rap sheet</Link>}
              </div>
              <div className="flex flex-col items-end gap-2">
                {s.status !== 'READY' && s.status !== 'FAILED' && <RapSheetDecision sheetId={s.id} personId={s.person.id} status={s.status} />}
                <RapSheetGenerateButton personId={s.person.id} sheetId={s.id} label={s.content ? 'Rebuild and email now' : 'Build and email now'} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
