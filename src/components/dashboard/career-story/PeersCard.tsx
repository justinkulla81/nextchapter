import type { PeerView } from '@/lib/career-story/peers'

// Counts of people, never promises. Small groups are not shown at all.
export function PeersCard({ peers, from }: { peers: PeerView; from: string | null }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="peers-heading">
      <h2 id="peers-heading" className="text-lg font-semibold tracking-tight">
        People like you
      </h2>
      {peers.enough ? (
        <>
          <p className="text-sm text-muted-foreground">
            Of about {peers.total} members who work in {from ?? 'your field'}, here is where some have put their attention. Everyone&apos;s story is different, and this is not a prediction.
          </p>
          <ul className="space-y-1 text-sm">
            {peers.rows.map((r) => (
              <li key={r.function}>
                {r.approx ? 'About ' : ''}
                <strong className="font-semibold">{r.people}</strong> are looking at {r.function}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          We do not have enough members with your background yet to show a pattern honestly, and we would rather show nothing than guess. As more people share where they are heading, you will see it here, as counts and never as a promise.
        </p>
      )}
    </section>
  )
}
