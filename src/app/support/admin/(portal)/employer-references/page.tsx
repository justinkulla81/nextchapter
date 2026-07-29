import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending — unclaimed',
  claimed: 'Claimed',
  declined: 'Declined',
}

// Prompt 65 section 1 — the only two places a pending submission is
// visible: the submitting employer sees their own, and this admin view.
// Nothing else in the app queries EmployerReferenceSubmission at all.
export default async function EmployerReferencesAdminPage() {
  await requireAdmin()

  const submissions = await prisma.employerReferenceSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employer References</h1>
        <p className="mt-1 text-muted-foreground">
          &quot;Give a Reference&quot; submissions — pending ones are unclaimed and not attached to
          any real candidate profile yet.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Employer</th>
              <th className="px-3 py-2">Departing employee</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Layoff signal</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {s.createdAt.toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{s.submitterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.submitterCompany} · {s.submitterEmail}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <p className="text-foreground">{s.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{s.employeeEmail}</p>
                </td>
                <td className="px-3 py-2">{STATUS_LABEL[s.status] ?? s.status}</td>
                <td className="px-3 py-2 text-xs">
                  {s.isLayoffContext ? (
                    <span className="text-foreground">
                      Yes — founder {s.founderNotifiedAt ? 'notified' : 'not notified'}, Attio{' '}
                      {s.attioSyncedAt ? 'synced' : s.attioSyncRequestedAt ? 'queued' : '—'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
