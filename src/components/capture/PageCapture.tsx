import { JourneyPicker } from '@/components/home/JourneyPicker'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { OwnerInquiry } from '@/components/capture/OwnerInquiry'
import { captureSource, ownerOffer, saveCopy, saveSource, type PageCaptureConfig } from '@/lib/capture/page-capture'

/**
 * The shared capture block for a public SEO page (state, county, city, industry, job title, company, college). The top part is for
 * a person: the first journey question (the same picker as the homepage, which ends in an email for the first-week plan) and an
 * email save/follow box. The bottom part (`PageCaptureOwner`) is for the organization behind the page. Both are rendered by the page
 * frames (SeoPage, TopicShell) from one config, so a page opts in with a single prop.
 */
export function PageCaptureTop({ capture }: { capture: PageCaptureConfig }) {
  const source = captureSource(capture)
  const copy = saveCopy(capture)
  return (
    <section aria-label={`Get started: ${capture.label}`} className="mt-8 rounded-2xl border border-border bg-white p-5 sm:p-6">
      <JourneyPicker source={source} compact />
      {capture.save && (
        <div className="mx-auto mt-6 max-w-xl border-t border-border pt-5">
          <SaveSearchForm q={capture.save.q} loc={capture.save.loc} remote={false} source={saveSource(capture.kind)} heading={copy.heading} blurb={copy.blurb} cta={copy.cta} />
        </div>
      )}
    </section>
  )
}

export function PageCaptureOwner({ capture }: { capture: PageCaptureConfig }) {
  const offer = ownerOffer(capture)
  return <OwnerInquiry {...offer} source={captureSource(capture)} label={capture.label} />
}
