import { cn } from '@/lib/utils'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

// Shared avatar for messaging, community recognition, and admin surfaces —
// never used on resumes/dossiers/hiring-manager-facing reports (see the
// profilePictureUrl schema comment for why). Pass null/undefined url to
// always fall back to initials, e.g. when the owner hasn't uploaded a photo.
export function AvatarDisplay({
  name,
  url,
  size = 32,
  className,
}: {
  name: string
  url?: string | null
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, same convention as CoachBrandHeader's logoUrl
        <img src={url} alt={name} className="size-full object-cover" />
      ) : (
        <span className="font-medium">{initials(name)}</span>
      )}
    </span>
  )
}
