import { PreviewShell } from '@/components/candidate/PreviewShell'
import { BeFound } from '@/components/network/BeFound'
import { PageHeader } from '@/components/candidate/PageHeader'
import { REDESIGN_PLACES } from '@/lib/nav/redesign-places'
import { menuEntries } from '@/lib/nav/places'
import { NO_SENIOR_OVERLAY, type MenuMode } from '@/lib/journey/menu'

export function BeFoundQuiet() {
  return (
    <PreviewShell place="network" entry="found">
      <BeFound mode="quiet" hasCoach={false} coachHref="/dashboard/coaching-match" />
    </PreviewShell>
  )
}

export function BeFoundPublic() {
  return (
    <PreviewShell place="network" entry="found">
      <BeFound mode="public" hasCoach={false} coachHref="/dashboard/coaching-match" />
    </PreviewShell>
  )
}

// The real menu rules, run for the same member twice.
export function SeniorMenuCompare() {
  const mode: MenuMode = 'EXPLORING'
  const locks = { hasEmailConnection: true, skillsAssessmentCompleted: true, mode }
  const paidAccess = { coaching: true, recruiters: true }
  const list = (placeKey: string, senior: boolean) => {
    const place = REDESIGN_PLACES.find((p) => p.key === placeKey)!
    return menuEntries(place, '/dashboard', { employed: true, locks, paidAccess, senior: senior ? { on: true, jobsRestored: false } : NO_SENIOR_OVERLAY })
  }
  return (
    <PreviewShell place="network" entry="found">
      <PageHeader title="Senior overlay: same menu, new order" intro="A member who is exploring a move, standard and as a senior leader. Nothing is removed; the job board is muted with one click to restore." />
      <div className="grid gap-6 sm:grid-cols-2">
        {(['network', 'jobs'] as const).map((k) => (
          <div key={k} className="space-y-4">
            {[false, true].map((senior) => (
              <div key={String(senior)} className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{k} · {senior ? 'Senior leader' : 'Standard'}</p>
                <ol className="mt-2 space-y-1 text-sm">
                  {list(k, senior).map((e, i) => (
                    <li key={e.label} className={e.muted ? 'text-muted-foreground/60' : 'text-ink'}>{i + 1}. {e.label}{e.muted ? ' (muted)  Show the job board normally' : ''}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PreviewShell>
  )
}
