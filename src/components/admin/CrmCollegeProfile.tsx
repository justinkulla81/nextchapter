import { prisma } from '@/lib/prisma'
import { CollegeProfileViewedTracker } from '@/components/admin/WorkforceBoardsViewTracker'

type Row = {
  unitid: string; name: string; city: string | null; state: string; website: string | null; control: string | null; level: string | null
  presidentName: string | null; presidentTitle: string | null; phone: string | null
  enrollment: number | null; alumniEstimate: number | null; alumniEstimateMethod: string | null; alumniReported: number | null
  tuitionInState: number | null; tuitionOutState: number | null; netPrice: number | null
  topMajors: { field: string; share: number }[] | null
  endowment: number | null; revenue: number | null; expenses: number | null; privateGifts: number | null; onlineGiving: number | null
  earnings6: number | null; earnings10: number | null; employedShare10: number | null; completionRate: number | null
  hasExecEd: boolean | null; hasRetraining: boolean | null; programNotes: string | null
  careerContactName: string | null; careerContactEmail: string | null; alumniContactName: string | null; alumniContactEmail: string | null
  dataYear: string | null
  score: number | null; tier: string | null; rank: number | null; scoreParts: Record<string, number | string[]> | null
}

const usd = (n: number | null) => (n == null ? null : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`)
const yn = (v: boolean | null) => (v == null ? 'Not yet researched' : v ? 'Yes' : 'None found')

function F({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? <span className="font-normal text-muted-foreground">Unknown</span>}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  )
}

/** The college facts, outcomes and internal fit score for a CRM organization that is a college. */
export async function CrmCollegeProfile({ orgId }: { orgId: string }) {
  const [c] = await prisma.$queryRaw<Row[]>`
    select p.*, l.score, l.tier, l.rank, l."scoreParts" from "LocalCollege" l join "CollegeProfile" p on p.unitid = l.id
    where l."crmOrgId" = ${orgId} limit 1`
  if (!c) return null
  return (
    <section className="rounded-lg border border-border p-4">
      <CollegeProfileViewedTracker unitid={c.unitid} tier={c.tier} hasExecEd={c.hasExecEd} hasRetraining={c.hasRetraining} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">College profile</h2>
        {c.score != null && (
          <span className="rounded bg-muted px-2 py-1 text-sm font-semibold" title="Pilot-partner score, 0-100 plus relationship">
            Tier {c.tier} · score {Math.round(c.score)}{c.rank ? ` · rank #${c.rank}` : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {c.control} · {c.level} · {c.city}, {c.state} · IPEDS/College Scorecard {c.dataYear ?? ''}
      </p>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3">
        <F label="Alumni" value={(c.alumniReported ?? c.alumniEstimate)?.toLocaleString()} note={c.alumniReported ? 'Reported' : c.alumniEstimateMethod ?? undefined} />
        <F label="Enrollment" value={c.enrollment?.toLocaleString()} />
        <F label="Tuition (in-state / out-of-state)" value={c.tuitionInState != null ? `${usd(c.tuitionInState)} / ${usd(c.tuitionOutState) ?? '—'}` : null} note={c.netPrice ? `Average net price ${usd(c.netPrice)}` : undefined} />
        <F label="Endowment" value={usd(c.endowment)} />
        <F label="Annual budget" value={usd(c.expenses)} note={c.revenue ? `Revenue ${usd(c.revenue)}` : undefined} />
        <F label="Annual giving" value={usd(c.onlineGiving) ?? usd(c.privateGifts)} note={c.onlineGiving ? 'Online giving' : c.privateGifts ? 'Private gifts total; online giving is not published' : 'Online giving is not published'} />
        <F label="Executive education" value={yn(c.hasExecEd)} note="Includes executive-format degrees such as an Executive MBA" />
        <F label="Retraining / upskilling" value={yn(c.hasRetraining)} note={c.programNotes ?? undefined} />
        <F label="Graduate outcomes" value={c.earnings10 ? `${usd(c.earnings10)} median earnings, 10 yrs` : null}
          note={[c.earnings6 ? `${usd(c.earnings6)} at 6 yrs` : null, c.employedShare10 != null ? `${Math.round(c.employedShare10 * 100)}% working at 10 yrs` : null, c.completionRate != null ? `${Math.round(c.completionRate * 100)}% complete` : null].filter(Boolean).join(' · ') || undefined} />
      </dl>
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Most popular fields (by degrees awarded)</h3>
        {c.topMajors?.length ? (
          <p className="mt-1 text-sm">{c.topMajors.map((m) => `${m.field} ${Math.round(m.share * 100)}%`).join(' · ')}</p>
        ) : <p className="mt-1 text-sm text-muted-foreground">Unknown</p>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <F label="Leadership" value={c.presidentName ? `${c.presidentName}${c.presidentTitle ? `, ${c.presidentTitle}` : ''}` : null} note={c.phone ?? undefined} />
        <F label="Career services" value={c.careerContactName ?? c.careerContactEmail} />
        <F label="Alumni relations" value={c.alumniContactName ?? c.alumniContactEmail} />
      </div>
      {c.scoreParts && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Why this score</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {(['contacts', 'fit', 'size', 'interest', 'profile', 'relationship'] as const).filter((k) => typeof c.scoreParts![k] === 'number').map((k) => (
              <li key={k}><span className="font-medium capitalize">{k}</span> {c.scoreParts![k] as number}</li>
            ))}
            {Array.isArray(c.scoreParts.notes) && c.scoreParts.notes.map((n) => <li key={n} className="text-muted-foreground">{n}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
}
