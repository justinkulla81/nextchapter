import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { createItem, promoteSpark, deleteItem } from '../actions'
import { KINDS, KIND_LABELS, formatDate } from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionBrainstormPage() {
  await requireAdmin()
  const sparks = await prisma.productItem.findMany({
    where: { status: 'SPARK' }, orderBy: { createdAt: 'desc' }, take: 200,
  })

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Brainstorm</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Write it down and move on. Nothing here needs a grade, an owner or an estimate — a brainstorm dies
          the moment each idea has to be judged before you can write the next one.
        </p>
      </header>

      {/* One field, focused on load: the whole point is that capture is faster
          than the thought. Kind defaults to Idea and can be ignored. */}
      <form action={createItem} className="rounded-lg border border-border p-4">
        <input type="hidden" name="status" value="SPARK" />
        <label htmlFor="spark-title" className="mb-1 block text-sm font-medium">What&apos;s the thought</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="spark-title" name="title" required autoFocus
            placeholder="Anything. Half-formed is fine."
            className="h-9 min-w-64 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <select name="kind" defaultValue="IDEA" aria-label="Kind" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
          <SubmitButton pendingLabel="Adding…">Add spark</SubmitButton>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sparks ({sparks.length})</h2>
        {sparks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing captured yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {sparks.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <span className="min-w-0">
                  <span className="text-sm">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {KIND_LABELS[s.kind]} · {formatDate(s.createdAt)}
                  </span>
                </span>
                {/* Two discrete outcomes -> adjacent buttons, per design-principles.md. */}
                <span className="flex shrink-0 gap-2">
                  <form action={promoteSpark.bind(null, s.id)}>
                    <SubmitButton size="sm" pendingLabel="Promoting…">Take it seriously</SubmitButton>
                  </form>
                  <form action={deleteItem.bind(null, s.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Deleting…">Discard</SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing leaves this list by accident. An unjudged idea sitting in a prioritised backlog is noise
          that makes the whole backlog less trusted.
        </p>
      </section>
    </div>
  )
}
