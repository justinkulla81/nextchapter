import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmTokenCreator } from '@/components/admin/CrmTokenCreator'
import { revokeCaptureToken } from './actions'
import { formatDate, sinceLabel } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmCaptureTokensPage() {
  await requireAdmin()
  const tokens = await prisma.crmCaptureToken.findMany({ orderBy: { createdAt: 'desc' } })
  const live = tokens.filter((t) => !t.revokedAt)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Capture tokens</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            For the browser extension. A token reaches one endpoint and can do nothing else — it is not your
            admin session, and it never grants access to this portal.
          </p>
        </div>
        <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">People</Link>
      </header>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        An extension runs on every page you visit, including hostile ones. That is why it holds a scoped token
        rather than a session cookie, why tokens are stored only as a hash, and why revoking one takes effect
        immediately.
      </div>

      <CrmTokenCreator />

      <section>
        <h2 className="mb-2 text-lg font-semibold">Tokens ({live.length} active)</h2>
        {tokens.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            None yet. Create one above, then paste it into the extension.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  <span className={`font-medium ${t.revokedAt ? 'text-muted-foreground line-through' : ''}`}>{t.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Created {formatDate(t.createdAt)} ·{' '}
                    {t.lastUsedAt ? `used ${sinceLabel(t.lastUsedAt)} · ${t.useCount} captures` : 'never used'}
                    {t.revokedAt && ` · revoked ${formatDate(t.revokedAt)}`}
                  </span>
                </span>
                {!t.revokedAt && (
                  <form action={revokeCaptureToken.bind(null, t.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Revoking…">Revoke</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 text-sm">
        <h2 className="font-semibold">Installing the extension</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create a token above and copy it.</li>
          <li>Open <code className="rounded bg-muted px-1">chrome://extensions</code>, turn on Developer mode.</li>
          <li>Choose <strong>Load unpacked</strong> and select the <code className="rounded bg-muted px-1">extension/</code> folder in the repo.</li>
          <li>Click the extension, paste this site&apos;s address and the token.</li>
        </ol>
      </section>
    </div>
  )
}
