import { ChevronDown } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getRecruiterSettings } from '@/lib/admin/recruiter-settings'
import { saveRecruiterSettings, createRecruiterFirm, updateRecruiterFirm } from './actions'
import { RecruiterSettingsForm } from '@/components/admin/RecruiterSettingsForm'
import { RecruiterFirmForm } from '@/components/admin/RecruiterFirmForm'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  VERIFIED: 'bg-brand/10 text-brand',
  SUSPENDED: 'bg-amber-500/10 text-amber-700',
  REMOVED: 'bg-destructive/10 text-destructive',
}

export default async function RecruiterSettingsAdminPage() {
  await requireAdmin()

  const [settings, firms] = await Promise.all([
    getRecruiterSettings(),
    prisma.recruiterFirm.findMany({
      include: { _count: { select: { recruiters: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter settings</h1>
        <p className="mt-1 text-muted-foreground">
          Global recruiter-operations policy plus per-firm onboarding, verification, and status — Master Build
          Script §A6.4. Global settings are one row, updated in place with every change logged. Firms are
          individually managed below.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Global settings</h2>
        <RecruiterSettingsForm action={saveRecruiterSettings} existing={settings} />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Firms ({firms.length})</h2>
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
            Add a firm
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3">
            <RecruiterFirmForm action={createRecruiterFirm} />
          </div>
        </details>

        {firms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No firms recorded yet. Recruiters can sign up without one (firmName stays free text on their own row);
            link a recruiter to a firm here once onboarding needs firm-level scope, seats, or status tracking.
          </p>
        ) : (
          <div className="space-y-3">
            {firms.map((firm) => (
              <Card key={firm.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {firm.name}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[firm.status]}`}>
                          {firm.status}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {firm._count.recruiters} recruiter{firm._count.recruiters === 1 ? '' : 's'} · {firm.seatCount}{' '}
                        seat{firm.seatCount === 1 ? '' : 's'}
                        {firm.accessScope && <> · scope: {firm.accessScope}</>}
                      </p>
                      {firm.exportDestinationsEnabled.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Export enabled: {firm.exportDestinationsEnabled.join(', ')}
                        </p>
                      )}
                      {firm.notes && <p className="mt-1 text-xs text-muted-foreground">{firm.notes}</p>}
                    </div>
                  </div>
                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
                      Edit
                      <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="mt-3">
                      <RecruiterFirmForm action={updateRecruiterFirm.bind(null, firm.id)} existing={firm} />
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
