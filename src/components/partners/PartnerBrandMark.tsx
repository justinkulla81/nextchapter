import { cn } from '@/lib/utils'
import { brandInitials, type PartnerBrand } from '@/lib/partners/brand'
import { readableTextOn } from '@/lib/higher-ed/branding'

// The partner's logo, or a monogram in their color when they have no logo yet.
// Logos sit on a white tile so a dark-on-transparent logo reads on the navy bar.
export function PartnerBrandMark({ brand, className }: { brand: PartnerBrand; className?: string }) {
  if (brand.logoUrl) {
    return (
      <span className={cn('flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  const bg = brand.accent ?? '#485872'
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold', className)}
      style={{ backgroundColor: bg, color: readableTextOn(bg) }}
    >
      {brandInitials(brand)}
    </span>
  )
}
