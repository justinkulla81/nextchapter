import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { JobsByExposure } from '@/components/candidate/AiExposure'
import { loadExposureMap, loadJobsByExposure } from '@/lib/skills/ai-exposure-server'
import type { JobsByExposure as Split } from '@/lib/skills/ai-exposure'

// Public section: what NextChapter shows about AI exposure, with the reason for each point. Facts only. It makes no
// comparison with other products (docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md, row 18) and no prediction: the score is
// AI use observed now. The live split and the occupation count come from our own data and hide when they cannot load.

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error('AI exposure section data unavailable:', error)
    return null
  }
}

export type AiExposureSectionProps = {
  /** The page it sits on, for the heading id. */
  page: 'home' | 'ai-skills'
  /** Show the sign-up action. Leave off where the page already ends with its own. */
  cta?: { event: string; properties: Record<string, unknown>; className: string }
}

/** The section body, separate from the data loading so it renders in tests with any data. */
export function AiExposureSectionView({ page, cta, split, occupations }: AiExposureSectionProps & { split: Split | null; occupations: number }) {
  const id = `ai-exposure-${page}`
  const points = [
    {
      title: 'Every opening shows how much AI use is observed in its occupation.',
      why: `Because it comes from real usage data, ${occupations > 0 ? `measured for ${occupations.toLocaleString('en-US')} occupations` : 'measured by occupation'}, not from opinion.`,
    },
    {
      title: 'Career pivots show the change in pay and the AI exposure side by side.',
      why: 'Because a move that pays more can sit in work where AI is used a lot, and you should see both before you choose.',
    },
    {
      title: 'Learning starts with the course that matches your role’s exposure and what postings ask for.',
      why: 'Because the skills worth building depend on how much AI is already used in your work and what employers list.',
    },
  ]
  return (
    <section className="bg-white pb-12" aria-labelledby={id}>
      <div className="mx-auto max-w-3xl px-6">
        <h2 id={id} className="font-display text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
          See where AI is already changing the jobs you are looking at
        </h2>
        <ul className="mt-6 space-y-5">
          {points.map((p) => (
            <li key={p.title}>
              <p className="text-base font-semibold text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">Why:</span> {p.why}
              </p>
            </li>
          ))}
        </ul>
        {split && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-semibold text-ink">The openings we see, by AI exposure</p>
            <JobsByExposure split={split} label="Openings by AI exposure" />
          </div>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          <span className="font-semibold text-ink">What exposure means:</span> the share of a job’s tasks that AI is already used for at work, measured from real usage today. It is not a forecast, and a low number means no use seen yet.
        </p>
        {!split && (
          <p className="mt-3 text-xs text-muted-foreground">
            Source: <a href="https://www.anthropic.com/research/labor-market-impacts" className="underline underline-offset-4">Anthropic Economic Index</a>, March 2026.
          </p>
        )}
        {cta && (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <TrackedLink href="/onboarding/desire" event={cta.event} properties={cta.properties} className={cta.className}>
              Get your Market Reality Assessment
            </TrackedLink>
            <Link href="/ai-skills" className="text-sm text-brand underline underline-offset-4">
              See which jobs ask for AI skills
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

/** The public section with live data. Server component; a failed load hides the split instead of showing a wrong number. */
export async function AiExposureSection(props: AiExposureSectionProps) {
  const [split, map] = await Promise.all([safely(() => loadJobsByExposure()), safely(() => loadExposureMap())])
  return <AiExposureSectionView {...props} split={split} occupations={map?.size ?? 0} />
}
