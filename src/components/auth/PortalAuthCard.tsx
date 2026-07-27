import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Shared chrome for the non-candidate login/forgot-password pages — gives
// each portal a visually distinct entry point (icon + label) without a new
// accent color per portal, matching the single-accent-color design rule.
export function PortalAuthCard({
  icon: Icon,
  portalLabel,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  portalLabel: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Icon className="size-3.5" />
            {portalLabel}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
