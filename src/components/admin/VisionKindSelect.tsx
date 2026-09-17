import type { ProductItemKind, ProductItemArea } from '@prisma/client'
import { KIND_GROUPS, KIND_LABELS, AREAS, AREA_LABELS } from '@/lib/vision/labels'

// Twelve kinds is past the point where a flat list reads as a list — the
// optgroups say which side of the business each one is a claim about, which
// is the same split the roadmap groups rows by.
export function KindSelect({
  name = 'kind', value, className, ariaLabel = 'Kind',
}: {
  name?: string
  value: ProductItemKind
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      name={name} defaultValue={value} aria-label={ariaLabel}
      className={className ?? 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'}
    >
      {KIND_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

/** Which part of the business the row is about — orthogonal to its kind. */
export function AreaSelect({
  name = 'area', value, className, ariaLabel = 'Area',
}: {
  name?: string
  value: ProductItemArea
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      name={name} defaultValue={value} aria-label={ariaLabel}
      className={className ?? 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'}
    >
      {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
    </select>
  )
}
