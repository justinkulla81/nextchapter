import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { saveVisionDoc, restoreVisionVersion } from '../actions'
import { formatDate } from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionDocPage() {
  await requireAdmin()
  const [current, versions] = await Promise.all([
    prisma.productVisionDoc.findFirst({ where: { isCurrent: true } }),
    prisma.productVisionDoc.findMany({ orderBy: { version: 'desc' }, take: 25 }),
  ])

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Master product vision</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every save creates a new version rather than overwriting. Exactly one is current — the failure
            mode with a vision document is never that it is missing, it is that three exist and nobody knows
            which is live.
          </p>
        </div>
        {current && (
          <Link
            href="/support/admin/vision/doc/download"
            prefetch={false}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Download Markdown
          </Link>
        )}
      </header>

      <form action={saveVisionDoc} className="space-y-3 rounded-lg border border-border p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Title</span>
          <input
            name="title" defaultValue={current?.title ?? 'NextChapter product vision'}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">The document</span>
          <textarea
            name="body" rows={26} required defaultValue={current?.bodyMarkdown ?? ''}
            placeholder={'# NextChapter — Master Document\n\n## 1. Background\n\nMarkdown. Headings become linkable sections that roadmap items can point at.'}
            className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">What changed <span className="font-normal text-muted-foreground">(optional)</span></span>
          <input
            name="changeNote" placeholder="Sharpened the ICP; dropped the marketplace angle"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Saving an unchanged document does nothing — a version that says nothing is worse than no version.
        </p>
        <SubmitButton pendingLabel="Saving…">
          {current ? `Save as version ${current.version + 1}` : 'Save as version 1'}
        </SubmitButton>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-semibold">History ({versions.length})</h2>
        {versions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No versions yet.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="font-medium">
                    Version {v.version}
                    {v.isCurrent && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">Current</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatDate(v.createdAt)}
                    {v.createdByEmail && ` · ${v.createdByEmail}`}
                    {v.changeNote && ` · ${v.changeNote}`}
                  </span>
                </span>
                {!v.isCurrent && (
                  <form action={restoreVisionVersion.bind(null, v.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Restoring…">Restore</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Restoring writes a new version whose body matches the old one, rather than moving the pointer
          backwards — otherwise everything written since would vanish from the history.
        </p>
      </section>
    </div>
  )
}
