import { prisma } from '@/lib/prisma'
import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'
import { EmployerReferenceForm } from './EmployerReferenceForm'

export const metadata = {
  title: 'Give a Reference | NextChapter',
}

// Same BARS-anchor fetch pattern as /ref/[token]/page.tsx — one shared
// instrument, this is just a second entry point into it.
export default async function GiveAReferenceSubmitPage() {
  const barsAnchors = await prisma.bARSAnchor.findMany({
    where: { isActive: true },
    orderBy: { scalePoint: 'asc' },
  })
  const dimensionGroups = ASSESSMENT_DIMENSIONS.map((dim) => ({
    dimension: dim.key,
    dimensionLabel: dim.label,
    anchors: barsAnchors
      .filter((a) => a.dimension === dim.key)
      .map((a) => ({ scalePoint: a.scalePoint, anchorText: a.anchorText })),
  }))

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for managers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Give a reference</h1>
        <p className="text-muted-foreground">
          About 15 minutes. Nothing here becomes visible or usable anywhere until the person
          you&apos;re referencing sees it themselves and chooses to accept it.
        </p>
      </div>
      <EmployerReferenceForm dimensionGroups={dimensionGroups} />
    </div>
  )
}
