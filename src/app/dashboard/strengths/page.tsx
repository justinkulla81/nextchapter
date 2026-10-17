import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Sparkles } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadStrengths } from '@/lib/profile/strengths-load'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { StrengthsViewed } from '@/components/dashboard/StrengthsViewed'

export const metadata: Metadata = { title: 'Why hire me' }

// Where the person stands out, with the evidence, and the "why hire me" in
// their words. Weak spots show here (privately) as roles to go into with a
// plan; they never appear to employers.
export default async function StrengthsPage() {
  const profile = await getDashboardProfile()
  const st = await loadStrengths(profile.id)
  const lead = st.shape === 'peaked' ? st.peaks : st.broad.slice(0, 4)
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Why hire me</h1>
        <p className="max-w-2xl text-muted-foreground">
          Where you stand out, from your assessments, references, track record and skills, not just what you’d say about yourself. Your job matches, pivot paths,
          Dossier and LinkedIn copy all lead with these.
        </p>
      </div>
      <StrengthsViewed shape={st.shape} peaks={st.peaks.map((p) => p.key)} />

      <section className="space-y-3 rounded-lg border border-border bg-card p-5" aria-labelledby="headline">
        <h2 id="headline" className="text-lg font-semibold">
          {st.headline}
        </h2>
        {st.shape !== 'emerging' && (
          <Suspense
            fallback={
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size={14} /> Writing your “why hire me”…
              </p>
            }
          >
            <WhyHire candidateId={profile.id} />
          </Suspense>
        )}
      </section>

      {lead.length > 0 ? (
        <section className="space-y-3" aria-labelledby="peaks-h">
          <h2 id="peaks-h" className="text-base font-semibold">
            {st.shape === 'peaked' ? 'Your standout strengths' : 'Where you’re strong'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lead.map((s) => (
              <li key={s.key} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <p className="font-medium">{s.label}</p>
                <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                  {s.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {st.shape === 'balanced' && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              No single peak is not a weakness. Teams need people who are reliably good at many things; say so plainly (“the person you can hand anything to”)
              and back it with one example for each.
            </p>
          )}
        </section>
      ) : (
        <EmptyState icon={Sparkles} title="Not enough evidence yet" description="Do one of the steps below and this fills in. References count most." />
      )}

      {st.weakSpots.length > 0 && (
        <section className="space-y-2" aria-labelledby="weak-h">
          <h2 id="weak-h" className="text-base font-semibold">
            Go in with a plan (private)
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Only you see this. We flag jobs and pivot paths that lean on these, so you can prepare or pick roles that play to your strengths.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {st.weakSpots.map((w) => (
              <li key={w.key}>
                <span className="font-medium">{w.label}:</span> {w.line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {st.missing.length > 0 && (
        <section className="space-y-2" aria-labelledby="sharpen-h">
          <h2 id="sharpen-h" className="text-base font-semibold">
            Sharpen this
          </h2>
          <ul className="space-y-1 text-sm">
            {st.missing.map((m) => (
              <li key={m}>
                {m}.{' '}
                <Link
                  className="text-primary underline underline-offset-4"
                  href={/How I Perform/.test(m) ? '/dashboard/how-i-perform' : /reference/i.test(m) ? '/dashboard/references' : /Track Record/.test(m) ? '/dashboard/track-record' : '/dashboard/resume'}
                >
                  Do it now
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// The AI write-up: reused while the inputs are unchanged, rewritten when they change.
async function WhyHire({ candidateId }: { candidateId: string }) {
  const st = await loadStrengths(candidateId, { writeUp: true })
  if (!st.whyHire) return <p className="text-sm text-muted-foreground">We couldn’t write this just now. Refresh in a minute.</p>
  return (
    <div className="space-y-2">
      <p className="text-base">{st.whyHire.statement}</p>
      {st.whyHire.proofPoints.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {st.whyHire.proofPoints.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Use it in your LinkedIn About, your “tell me about yourself”, and your cover notes.</p>
    </div>
  )
}
