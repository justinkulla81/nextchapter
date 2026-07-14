import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'

export function WorkStyleProfileCard({ dimensionVectors }: { dimensionVectors: DimensionVectors }) {
  const summary = translateDimensionVectors(dimensionVectors)

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {ASSESSMENT_DIMENSIONS.map((d) => (
        <div key={d.key}>
          <dt className="text-sm font-medium text-navy">{d.label}</dt>
          <dd className="text-sm text-muted-foreground">{summary[d.key]}</dd>
        </div>
      ))}
    </dl>
  )
}
