import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { keepSchoolSeparate, mergeSchoolIntoSuggestion } from './actions'

export const maxDuration = 30

/**
 * Schools on resumes that look like a variant of a known institution but are not an
 * identical name. They are kept as their own school until someone decides: merging a
 * wrong pair would put two universities' alumni in one network.
 */
export default async function SchoolLinksPage() {
  await requireAdmin()
  const pending = await prisma.school.findMany({
    where: { reviewState: 'REVIEW', mergeSuggestionId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { id: true, name: true, mergeSuggestionId: true, _count: { select: { educationEntries: true } } },
  })
  const targets = await prisma.school.findMany({
    where: { id: { in: pending.map((p) => p.mergeSuggestionId!) } },
    select: { id: true, name: true },
  })
  const targetName = new Map(targets.map((t) => [t.id, t.name]))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">School links</h1>
        <p className="text-muted-foreground">
          Resume schools that look like a known institution but don&apos;t match exactly. Merge the ones that are the same
          school; keep the rest separate and they won&apos;t be suggested again.
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nothing to review right now.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {pending.map((s) => (
            <div key={s.id} className="space-y-3 p-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">{s.name}</span>{' '}
                <span className="text-muted-foreground">
                  ({s._count.educationEntries} {s._count.educationEntries === 1 ? 'entry' : 'entries'}) — same as{' '}
                  <span className="text-foreground">{targetName.get(s.mergeSuggestionId!) ?? 'unknown'}</span>?
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={mergeSchoolIntoSuggestion}>
                  <input type="hidden" name="sourceId" value={s.id} />
                  <Button type="submit" size="sm">
                    Merge into {targetName.get(s.mergeSuggestionId!) ?? 'suggestion'}
                  </Button>
                </form>
                <form action={keepSchoolSeparate}>
                  <input type="hidden" name="sourceId" value={s.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Keep separate
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
