// The splash picture across the top of a workforce hub (owner, 2026-11-18: every hub has its own picture, none repeats another's). The
// picture comes from the organization's profile (hubHeroes by hub); with none stored the banner is left out rather than drawn empty.

import type { HubHero } from '@/lib/higher-ed/profile'

const LINES: Record<string, string> = {
  wfhub: 'Funding, layoffs and training, in one place',
  business: 'The employers you serve, and the talent they need',
  education: 'Training aimed at the jobs the region has',
  partnerhub: 'The region’s partners, working as one',
}

export function HubBanner({ hub, title, hero }: { hub: string; title: string; hero: HubHero | undefined }) {
  if (!hero?.url) return null
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-xl border border-border bg-primary/10 sm:h-44">
      {/* eslint-disable-next-line @next/next/no-img-element -- a licensed or uploaded picture of the region */}
      <img src={hero.url} alt="" className="absolute inset-0 size-full object-cover object-[center_40%]" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-10 sm:p-5 sm:pt-12">
        <p className="text-sm font-medium text-white/90">{title}</p>
        <p className="text-lg font-semibold text-white sm:text-xl">{LINES[hub] ?? ''}</p>
      </div>
      {hero.credit && (
        <a href={hero.sourceUrl ?? undefined} target="_blank" rel="noreferrer" className="absolute top-2 right-2 max-w-[70%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90 hover:underline">
          {hero.credit}
        </a>
      )}
    </div>
  )
}
