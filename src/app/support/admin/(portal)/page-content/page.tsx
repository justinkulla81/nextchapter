import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createPageContent, updatePageContent, togglePageContentActive, deletePageContent } from './actions'
import { PageContentForm } from '@/components/admin/PageContentForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export const maxDuration = 30

export default async function PageContentAdminPage() {
  await requireAdmin()

  const items = await prisma.pageContent.findMany({
    orderBy: [{ pageKey: 'asc' }, { boxType: 'asc' }, { isPinned: 'desc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Page Content</h1>
        <p className="mt-1 text-muted-foreground">
          Daily Message and Why It Matters content for every dashboard page&apos;s 3-box header. A pinned Daily
          Message always shows first, to every candidate, until dismissed for the day. Why It Matters dismissals
          are permanent (until the candidate re-enables from Privacy Settings), so keep that content evergreen
          rather than time-sensitive.
        </p>
      </div>

      <PageContentForm action={createPageContent} />

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No content yet.</p>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {item.pageKey} · {item.boxType === 'DAILY_MESSAGE' ? 'Daily Message' : 'Why It Matters'}
                    </p>
                    <p className="font-medium">
                      {item.title}
                      {item.isPinned && (
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                          Pinned
                        </span>
                      )}
                      {!item.isActive && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </p>
                    {item.leadIn && <p className="mt-1 text-sm text-muted-foreground">{item.leadIn}</p>}
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {item.bullets.map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                    {item.footer && <p className="mt-1 text-xs text-muted-foreground">{item.footer}</p>}
                    {item.videoProvider && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Video: {item.videoProvider} — {item.videoUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <form action={togglePageContentActive.bind(null, item.id, item.isActive)}>
                      <SubmitButton variant="ghost" size="sm">
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </SubmitButton>
                    </form>
                    <form action={deletePageContent.bind(null, item.id)}>
                      <SubmitButton variant="ghost" size="sm">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-brand">Edit</summary>
                  <div className="mt-3">
                    <PageContentForm action={updatePageContent.bind(null, item.id)} existing={item} />
                  </div>
                </details>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
