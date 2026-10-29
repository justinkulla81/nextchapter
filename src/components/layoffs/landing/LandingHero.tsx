import Image from 'next/image'
import { landingHeadline, pickPagePhoto, type LandingVariant } from '@/lib/layoffs/landing'

const VIC_NOTE: Record<LandingVariant, string> = {
  buyout: 'Whichever way you are leaning, the first week matters most. Tell us where you stand and we will send the plan.',
  layoff: 'The first week sets the pace. Tell us where you stand and we will send the plan.',
  neither: 'You do not need a reason to look around. Tell us where you stand and we will send a plan.',
}

/** The top of a company page: a plain headline, one sourced line of context, a rotating photo and Vic's note. */
export function LandingHero({ variant, name, slug, latestWorkers, hasNotices = true, context }: {
  variant: LandingVariant
  name: string
  slug: string
  latestWorkers: number | null
  /** False for a page built only from announcements and press reports (nothing filed with a state). */
  hasNotices?: boolean
  /** One sourced line under the headline (what was announced or filed), already worded. */
  context: React.ReactNode
}) {
  const photo = pickPagePhoto(slug)
  // Never the same face twice on a page: Vic's small headshot shows only when the big picture is someone else.
  const showVicHeadshot = photo.who !== 'vic'
  return (
    <section aria-labelledby="landing-h1" className="grid gap-6 rounded-3xl bg-gradient-to-br from-navy to-brand p-6 text-white sm:p-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Independent page. Not from or affiliated with {name}.</p>
        <h1 id="landing-h1" className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight [text-wrap:balance] sm:text-4xl">
          {landingHeadline(variant, name, latestWorkers, hasNotices)}
        </h1>
        <p className="mt-4 max-w-xl text-base opacity-90">{context}</p>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
        <Image src={photo.src} alt={photo.alt} width={800} height={800} priority className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-start gap-3 p-4">
          {showVicHeadshot && <Image src="/marketing/victoria-headshot-v4.jpg" alt="Vic" width={48} height={48} className="size-12 shrink-0 rounded-full border-2 border-orange object-cover" />}
          <div className="text-sm">
            <p className="font-semibold">Vic</p>
            <p className="opacity-90">{VIC_NOTE[variant]}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
