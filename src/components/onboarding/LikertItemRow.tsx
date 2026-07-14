import { RatingScale } from '@/components/references/RatingScale'

export function LikertItemRow({
  itemId,
  itemText,
  onAnswered,
  highlighted,
}: {
  itemId: string
  itemText: string
  onAnswered?: (itemId: string) => void
  highlighted?: boolean
}) {
  return (
    <RatingScale
      id={`likert-item-${itemId}`}
      name={`likertScore-${itemId}`}
      label={itemText}
      onAnswered={() => onAnswered?.(itemId)}
      highlighted={highlighted}
    />
  )
}
