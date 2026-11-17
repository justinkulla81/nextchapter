import Link from 'next/link'

// The splash at the top of an organization's Home: its own picture (a city, a campus, an office building) with the
// organization's line on it and three numbers underneath, each saying where it comes from. Used by the workforce Talent
// Hub, the college Home and the employer Home. Until the organization uploads a picture, a plain drawing stands in, and
// whoever can edit the branding sees a link to change it.

export type HeroStat = { label: string; value: string; note?: string }
export type HeroPlaceholder = 'skyline' | 'campus' | 'office'

const DRAWINGS: Record<HeroPlaceholder, { label: string; shapes: React.ReactNode }> = {
  skyline: {
    label: 'Placeholder skyline',
    shapes: (
      <>
        <rect x="40" y="110" width="60" height="110" />
        <rect x="110" y="70" width="50" height="150" />
        <rect x="170" y="130" width="70" height="90" />
        <rect x="250" y="40" width="56" height="180" />
        <rect x="316" y="95" width="64" height="125" />
        <rect x="390" y="120" width="48" height="100" />
        <rect x="448" y="60" width="62" height="160" />
        <rect x="520" y="105" width="70" height="115" />
        <rect x="600" y="80" width="52" height="140" />
        <rect x="662" y="125" width="80" height="95" />
      </>
    ),
  },
  campus: {
    label: 'Placeholder campus',
    shapes: (
      <>
        <rect x="120" y="120" width="160" height="100" />
        <rect x="320" y="90" width="160" height="130" />
        <polygon points="320,90 400,40 480,90" />
        <rect x="388" y="20" width="24" height="40" />
        <rect x="520" y="120" width="160" height="100" />
        <rect x="40" y="170" width="720" height="50" opacity="0.5" />
      </>
    ),
  },
  office: {
    label: 'Placeholder office building',
    shapes: (
      <>
        <rect x="260" y="30" width="280" height="190" />
        <rect x="120" y="110" width="120" height="110" />
        <rect x="560" y="90" width="120" height="130" />
      </>
    ),
  },
}

export function OrgHomeHero({
  name,
  line,
  tagline,
  imageUrl,
  credit,
  creditUrl,
  stats,
  placeholder = 'skyline',
  logoUrl,
  editHref,
}: {
  name: string
  /** The small line on the picture: the region, the campus town, or the organization's name. */
  line: string
  tagline: string | null
  imageUrl: string | null
  credit?: string | null
  creditUrl?: string | null
  stats: HeroStat[]
  placeholder?: HeroPlaceholder
  logoUrl?: string | null
  /** Where the picture and line are changed. Shown only to people who can change them. */
  editHref?: string | null
}) {
  const drawing = DRAWINGS[placeholder]
  return (
    <section aria-label={`${name} overview`} className="overflow-hidden rounded-xl border border-border">
      <div className="relative h-44 w-full bg-primary/10 sm:h-56">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the organization's own uploaded or licensed picture
          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover object-[center_30%]" />
        ) : (
          <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label={`${drawing.label}: upload your own picture`} className="absolute inset-0 size-full text-primary">
            <rect width="800" height="220" fill="currentColor" opacity="0.08" />
            <g fill="currentColor" opacity="0.28">
              {drawing.shapes}
            </g>
          </svg>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/80 via-black/55 to-transparent p-4 pt-10 sm:p-6 sm:pt-12">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- the organization's uploaded logo
            <img src={logoUrl} alt={`${name} logo`} className="size-12 shrink-0 rounded-lg bg-white object-contain p-1 sm:size-14" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90">{line}</p>
            {tagline && <p className="text-lg font-semibold text-white sm:text-xl">{tagline}</p>}
          </div>
        </div>
        {/* The license (CC BY or BY-SA) asks for the credit; small, in the corner. */}
        {imageUrl && credit && (
          <a href={creditUrl ?? undefined} target="_blank" rel="noreferrer" className="absolute top-2 right-2 max-w-[70%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90 hover:underline">
            {credit}
          </a>
        )}
        {editHref && (
          <Link href={editHref} className="absolute top-2 left-2 rounded bg-black/55 px-2 py-1 text-xs font-medium text-white hover:underline focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
            {imageUrl ? 'Change picture' : 'Add your picture'}
          </Link>
        )}
      </div>
      {stats.length > 0 && (
        <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
          {stats.map((x) => (
            <div key={x.label} className="bg-card p-4">
              <dt className="text-xs font-medium text-muted-foreground">{x.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{x.value}</dd>
              {x.note && <p className="mt-0.5 text-xs text-muted-foreground">{x.note}</p>}
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
