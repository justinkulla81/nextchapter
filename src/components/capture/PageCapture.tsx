import { JourneyPicker } from '@/components/home/JourneyPicker'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { NextStepBox } from '@/components/capture/NextStepBox'
import { OwnerInquiry } from '@/components/capture/OwnerInquiry'
import { FollowTopicBox } from '@/components/capture/FollowTopicBox'
import { isFollowable } from '@/lib/leads/topic-follow'
import type { NetworkAsk } from '@/lib/community/network-copy'
import { captureSource, ownerOffer, saveCopy, saveSource, type PageCaptureConfig } from '@/lib/capture/page-capture'

/**
 * The shared capture block for a public SEO page (state, county, city, industry, job title, company, college). The top part is for
 * a person: the first journey question (the same picker as the homepage, which ends in an email for the first-week plan) and an
 * email save/follow box. The bottom part (`PageCaptureOwner`) is for the organization behind the page. Both are rendered by the page
 * frames (SeoPage, TopicShell) from one config, so a page opts in with a single prop.
 */
export function PageCaptureTop({ capture, network }: { capture: PageCaptureConfig; network?: NetworkAsk }) {
  const source = captureSource(capture)
  const copy = saveCopy(capture)
  const body = (
    <>
      <JourneyPicker source={source} compact />
      {capture.save && (
        <div className="mx-auto mt-6 max-w-xl border-t border-border pt-5">
          {isFollowable(capture.save.q, capture.save.loc) ? (
            // A signed-in member gets one button (their account email is already verified); everyone else gets the email box.
            <FollowTopicBox q={capture.save.q} loc={capture.save.loc} source={saveSource(capture.kind)} label={copy.heading.replace(/^Follow /, '')}>
              <SaveSearchForm q={capture.save.q} loc={capture.save.loc} remote={false} source={saveSource(capture.kind)} heading={copy.heading} blurb={copy.blurb} cta={copy.cta} />
            </FollowTopicBox>
          ) : (
            <SaveSearchForm q={capture.save.q} loc={capture.save.loc} remote={false} source={saveSource(capture.kind)} heading={copy.heading} blurb={copy.blurb} cta={copy.cta} />
          )}
        </div>
      )}
    </>
  )
  return <NextStepBox audience="seeker" slug={capture.slug} extras={body} network={network} />
}

export function PageCaptureOwner({ capture }: { capture: PageCaptureConfig }) {
  const offer = ownerOffer(capture)
  return <OwnerInquiry {...offer} source={captureSource(capture)} label={capture.label} />
}
