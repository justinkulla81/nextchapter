import { memberPool, peopleWhoWorkLikeYou } from '@/lib/profile/people-like-you'

// Pivot paths: what NextChapter members who work like you do now, by kind of
// role. Counts only; shows nothing until at least five are alike.
export async function WorkAlikeCard({ candidateId }: { candidateId: string }) {
  const alike = await memberPool()
    .then((pool) => peopleWhoWorkLikeYou(candidateId, pool))
    .catch(() => null)
  if (!alike || !alike.roles.length) return null
  return (
    <section aria-labelledby="alike-h" className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h2 id="alike-h" className="text-base font-semibold">
        People who work like you
      </h2>
      <p className="text-sm text-muted-foreground">{alike.similar} NextChapter members have a work style close to yours. Here’s the kind of work they do now:</p>
      <p className="text-sm">{alike.roles.map((r) => `${r.label} (${r.n})`).join(' · ')}</p>
    </section>
  )
}
