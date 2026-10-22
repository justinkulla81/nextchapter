'use client'

// CareerOneStop's Web API agreement (Oct 15, 2026 email to Justin): "Our logo
// must be displayed on all pages containing our Web API tools." This is their
// published "Link to Us" logo (careeronestop.org/Developers/WidgetsAndLogos/
// careeronestop-logo.aspx, 122x62), self-hosted and linked to their homepage
// as their embed code does. Shown small, in the page's source-note area,
// wherever CareerOneStop data is credited. The white plate keeps the logo
// (dark text on transparent) readable in dark mode.

import Image from 'next/image'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export const CAREERONESTOP_URL = 'https://www.careeronestop.org'

export function CareerOneStopCredit({
  surface,
  label = 'Data via',
  className,
}: {
  surface: string
  label?: string
  className?: string
}) {
  return (
    <p className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span>{label}</span>
      <a
        href={CAREERONESTOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="CareerOneStop (opens careeronestop.org)"
        onClick={() => posthog.capture('careeronestop_attribution_clicked', { surface })}
        className="inline-block rounded bg-white px-1"
      >
        <Image src="/logos/careeronestop.png" alt="careeronestop logo" width={92} height={47} unoptimized />
      </a>
    </p>
  )
}
