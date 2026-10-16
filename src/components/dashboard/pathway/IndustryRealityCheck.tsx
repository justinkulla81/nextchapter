import { prisma } from '@/lib/prisma'
import { assessIndustryMove } from '@/lib/journey/industry-feasibility'

// For each industry the member wants to move into: is it an easy move (your function carries over), one
// where the rules need learning (regulated), or a bigger step. We inform; nothing here blocks a choice.
export async function IndustryRealityCheck({ candidateId, currentIndustry, targetIndustries, fn }: { candidateId: string; currentIndustry: string | null; targetIndustries: string[]; fn: string | null }) {
  if (targetIndustries.length === 0) return null
  const tr = await prisma.trackRecordResponse.findUnique({ where: { candidateId }, select: { sectorHistory: true } })
  const moves = targetIndustries.slice(0, 6).map((i) => assessIndustryMove(currentIndustry, i, fn, { sectorHistory: tr?.sectorHistory ?? [] }))
  return (
    <section className="space-y-2 rounded-lg border border-border p-4" aria-labelledby="industry-check-heading">
      <h2 id="industry-check-heading" className="text-sm font-medium text-muted-foreground">
        A reality check on your target industries
      </h2>
      <ul className="space-y-2 text-sm">
        {moves.map((m) => (
          <li key={m.to}>
            <span className="font-medium">{m.to}:</span> <span className="text-muted-foreground">{m.headline}. {m.detail}</span>
            {m.learn.length > 0 && <span className="block text-muted-foreground">To do first: {m.learn.join('; ')}.</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
