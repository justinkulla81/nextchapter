import Link from 'next/link'
import { programForCandidate } from '@/lib/employer/program-server'

// For someone enrolled by a former employer: the program name, the
// employer's welcome, and the services it covers.
export async function OutplacementProgramCard({ candidateId }: { candidateId: string }) {
  const p = await programForCandidate(candidateId)
  if (!p) return null
  return (
    <section aria-labelledby="op-program" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="op-program" className="text-base font-semibold">
          {p.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          Provided by {p.orgName}
          {p.termEndAt ? ` through ${new Date(p.termEndAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : ''}. {p.orgName} never sees your search; only whether you land, if you choose to share it.
        </p>
      </div>
      {p.settings.welcome && <p className="whitespace-pre-line text-sm">{p.settings.welcome}</p>}
      {p.offered.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {p.offered.map((f) => (
            <li key={f.key}>
              {f.href ? (
                <Link href={f.href} target={f.provider === 'own' ? '_blank' : undefined} className="block h-full rounded-md border border-border p-3 text-sm hover:border-primary">
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.provider === 'own' ? (f.note ?? `From ${p.orgName}`) : f.what}</span>
                  {f.provider === 'own' && <span className="mt-1 block text-xs text-muted-foreground">Provided by {p.orgName}</span>}
                </Link>
              ) : (
                <div className="h-full rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-xs">{f.note}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Provided by {p.orgName}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
