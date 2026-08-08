'use client'

import { usePostHog } from 'posthog-js/react'
import { Card, CardContent } from '@/components/ui/card'
import type { Guide } from '@/lib/constants/guides'

// Every guide is unlocked wherever it appears — no gating left. Guides live
// at the bottom of the one dashboard page most relevant to their content
// (see GuidePageSlot in guides.ts), so a candidate only ever sees a guide
// once it's actually relevant to them.
export function GuideCard({ guide }: { guide: Guide }) {
  const posthog = usePostHog()

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
