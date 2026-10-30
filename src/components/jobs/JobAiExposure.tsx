import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, exposureSentence, scorePercent } from '@/lib/skills/ai-exposure'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'

// On a public job page: how much of this occupation's work AI is already used for, from the same data as /tools/ai-job-check.
// Data nobody else holds per job, so it is on the page for everyone and for search. Nothing when the job has no occupation or the
// occupation is not scored; a failed read just leaves the block out.

export async function JobAiExposure({ jobId, socCode }: { jobId: string; socCode: string | null | undefined }) {
  const e = await loadExposureForSoc(socCode).catch(() => null)
  if (!e) return null
  const properties = { jobId, soc6: e.soc6, band: e.band }
  return (
    <section aria-labelledby="job-ai-exposure" className="mt-8 rounded-xl border border-border bg-white p-5">
      <h2 id="job-ai-exposure" className="font-display text-xl font-semibold">How AI is used in this kind of work</h2>
      <p className="mt-2 text-[15px] leading-relaxed">
        {exposureSentence(e)} Measured exposure for {e.title.toLowerCase()}: {scorePercent(e.score)} ({BAND_LABEL[e.band].toLowerCase()}).
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{EXPOSURE_WHY} Source: {AI_EXPOSURE_SOURCE.name}.</p>
      <p className="mt-3 text-sm">
        <TrackedLink href="/tools/ai-job-check" event="job_page_ai_exposure_clicked" properties={properties} className="font-semibold text-brand underline underline-offset-4">
          Check how this applies to your own job
        </TrackedLink>
      </p>
    </section>
  )
}
