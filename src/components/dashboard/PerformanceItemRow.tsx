import { RatingScale } from '@/components/references/RatingScale'

// 4-point agreement scale, no neutral midpoint — spec §3.3. Field name uses
// the item's numeric id (1-40) so parsePerformanceForm can read it back
// without a lookup table.
export function PerformanceItemRow({
  itemId,
  itemText,
  onAnswered,
  highlighted,
}: {
  itemId: number
  itemText: string
  onAnswered?: (itemId: number) => void
  highlighted?: boolean
}) {
  return (
    <RatingScale
      id={`performance-item-${itemId}`}
      name={`performanceScore-${itemId}`}
      label={itemText}
      points={[1, 2, 3, 4]}
      onAnswered={() => onAnswered?.(itemId)}
      highlighted={highlighted}
    />
  )
}
