import { initials } from '@/lib/higher-ed/branding'

// The college's logo, or a monogram in its accent color when none is set.
export function InstitutionMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary college-hosted logo URL
    return <img src={logoUrl} alt={`${name} logo`} className="size-9 rounded-md object-contain" />
  }
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
      {initials(name)}
    </span>
  )
}
