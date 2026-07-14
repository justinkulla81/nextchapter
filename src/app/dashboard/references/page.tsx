import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { ReferenceRequestForm } from '@/components/references/ReferenceRequestForm'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReferenceStatus } from '@prisma/client'

const STATUS_STYLES: Record<ReferenceStatus, string> = {
  REQUESTED: 'bg-muted text-muted-foreground',
  REMINDER_SENT: 'bg-muted text-muted-foreground',
  COMPLETED: 'bg-primary/10 text-primary',
  DECLINED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-destructive/10 text-destructive',
}

const STATUS_LABELS: Record<ReferenceStatus, string> = {
  REQUESTED: 'Requested',
  REMINDER_SENT: 'Reminder sent',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
}

export default async function ReferencesPage() {
  const profile = await getDashboardData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">References</h1>
        <p className="mt-1 text-muted-foreground">
          Real relationship capital. A hiring manager trusts a former colleague&apos;s account of
          how you work more than anything on your resume — and it&apos;s one of the few signals in
          your Hireability Grade that you can&apos;t inflate yourself. Request at least 3, ideally
          5-10, from people who&apos;ve actually worked alongside you.
        </p>
      </div>

      <ReferenceRequestForm />

      {profile.references.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Requested references</h2>
          {profile.references.map((ref) => (
            <Card key={ref.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div className="space-y-1">
                  <p className="font-medium">{ref.refereeName}</p>
                  <p className="text-sm text-muted-foreground">
                    {RELATIONSHIP_TYPE_LABELS[ref.relationshipType]}
                    {ref.refereeCompany ? ` · ${ref.refereeCompany}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                    STATUS_STYLES[ref.status]
                  )}
                >
                  {STATUS_LABELS[ref.status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
