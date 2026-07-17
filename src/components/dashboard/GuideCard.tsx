'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Guide } from '@/lib/constants/guides'

export function GuideCard({ guide, unlocked }: { guide: Guide; unlocked: boolean }) {
  const posthog = usePostHog()

  if (unlocked) {
    return (
      <a
        href={`/guides/${guide.slug}.pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={() => posthog?.capture('guide_unlocked', { guideSlug: guide.slug, unlockReason: 'viewed' })}
      >
        <Card className="h-full transition-colors hover:border-brand">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground">{guide.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-brand">Read the guide →</span>
          </CardContent>
        </Card>
      </a>
    )
  }

  return (
    <Card className="h-full border-dashed">
      <CardContent className="pt-6">
        <div className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-muted-foreground">
            🔒
          </span>
          <h3 className="font-semibold text-foreground">{guide.title}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
        {guide.lockedTeaser && (
          <p className="mt-2 text-xs text-muted-foreground italic">{guide.lockedTeaser}</p>
        )}
        {guide.activateHref && (
          <Button nativeButton={false} size="sm" variant="outline" className="mt-4" render={<Link href={guide.activateHref} />}>
            Activate
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
