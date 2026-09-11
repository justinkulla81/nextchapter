'use client'

import { useTransition } from 'react'
import { setCompetitorCell } from '@/app/support/admin/(portal)/vision/actions'
import { OVERLAPS, OVERLAP_LABELS, OVERLAP_CLASS } from '@/lib/vision/labels'
import type { ProductCompetitorOverlap } from '@prisma/client'

// One cell of the matrix. Red where they HAVE a feature and green where they
// do not, because this grid is read to find gaps and moats — the color tracks
// "is this a problem for us", not "is this true".
export function VisionMatrixCell({
  competitorId, itemId, overlap, competitorName, featureName,
}: {
  competitorId: string
  itemId: string
  overlap: ProductCompetitorOverlap
  competitorName: string
  featureName: string
}) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label={`Does ${competitorName} have ${featureName}`}
      defaultValue={overlap}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ProductCompetitorOverlap
        start(() => { void setCompetitorCell(competitorId, itemId, next) })
      }}
      className={`h-7 w-full rounded border-0 px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-brand ${OVERLAP_CLASS[overlap]} ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {OVERLAPS.map((o) => <option key={o} value={o}>{OVERLAP_LABELS[o]}</option>)}
    </select>
  )
}
