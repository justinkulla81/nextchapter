import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { layoffAlertView } from '@/lib/warn/layoff-alert-view'

export const maxDuration = 30

/** One layoff, laid out like the alert email: the facts, the local picture, and everyone to contact with a Write email button on each. */
export default async function LayoffNoticePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const view = await layoffAlertView(id).catch(() => null)
  if (!view) notFound()
  return (
    <div className="space-y-4">
      <nav className="text-sm">
        <Link href="/support/admin/crm/warn" className="text-muted-foreground hover:underline">← Layoff notices</Link>
      </nav>
      <p className="max-w-2xl text-xs text-muted-foreground">
        Built from what is already stored (no new contact lookups). Write email opens Gmail from justin@launchyournextchapter.com; nothing is sent from here.
      </p>
      <div className="max-w-3xl rounded-lg border border-border bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: view.html }} />
    </div>
  )
}
