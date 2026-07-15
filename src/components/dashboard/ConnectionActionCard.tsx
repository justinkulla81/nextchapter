import { Card, CardContent } from '@/components/ui/card'
import type { ConnectionAction } from '@/lib/daily/connection-action'

export function ConnectionActionCard({ action }: { action: ConnectionAction }) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today, get out there
        </p>
        <p className="mt-1 font-medium text-foreground">{action.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
      </CardContent>
    </Card>
  )
}
