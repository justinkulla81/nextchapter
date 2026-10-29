import Link from 'next/link'
import { ActionBand, H2, LINK, SeoPage, Stat } from '@/components/seo/SeoPage'
import { ClaimHint } from '@/components/seo/ClaimHint'
import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'

// The shared look for public and claimable pages (SeoPage look="audience"), shown on sample workforce, higher-education and
// recruiter pages. The live pages keep their own content; only the frame, stat cards and next-step card change.

const claim = (who: string) => <ClaimHint who={who} href="/government-workforce#claim" event="org_page_claim_clicked" />

export function PublicLookWorkforce() {
  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Workforce boards', path: '/workforce-boards' }, { name: 'Washington', path: '/workforce-boards/washington' }, { name: 'Workforce Development Council of Seattle-King County', path: '/workforce-boards/washington/seattle-king' }]}
      h1="Workforce Development Council of Seattle-King County"
      lede={<>A workforce board in Seattle, WA. It serves King County, where 8,412 professional jobs are open today.{claim('Do you run this board?')}</>}
    >
      <OrgCandidateBand orgName="the Council" branded={false} peopleCount={null} properties={{ kind: 'WORKFORCE_BOARD' }} />
      <section aria-labelledby="market" className="mt-10">
        <h2 id="market" className={H2}>Jobs where it serves</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="8,412" label="open professional jobs" note="In 1 county" />
          <Stat value="1,206" label="entry-level or early-career" />
          <Stat value="311" label="say no experience is needed" note="64 more describe paid training" />
          <Stat value="3.9%" label="unemployment, August 2026" note="2.3 million residents" />
        </ul>
      </section>
      <ActionBand title="Claim this page" body="Add your own services, events and contacts. It is free, and the page stays yours." label="Claim this page" href="/government-workforce#claim" event="org_page_claim_clicked" properties={{ kind: 'WORKFORCE_BOARD' }} />
    </SeoPage>
  )
}

export function PublicLookHigherEd() {
  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Higher education', path: '/higher-education' }, { name: 'Washington', path: '/higher-education/washington' }, { name: 'Seattle University', path: '/higher-education/washington/seattle-university' }]}
      h1="Seattle University: career help for students and alumni"
      lede={<>A private university in Seattle, WA. See where its graduates work and which employers are hiring nearby.{claim('Do you work at Seattle University?')}</>}
    >
      <section aria-labelledby="grads" className="mt-10">
        <h2 id="grads" className={H2}>Where graduates end up</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="94%" label="employed or in school six months out" />
          <Stat value="$68,400" label="median pay, ten years after entry" />
          <Stat value="412" label="open jobs within 30 miles" />
          <Stat value="38" label="employers hiring from the region" />
        </ul>
      </section>
      <ActionBand title="Run career services here?" body="Claim the page to add events, employer contacts and an alumni community. It is free." label="Claim this page" href="/higher-education#claim" event="org_page_claim_clicked" properties={{ kind: 'COLLEGE' }} />
      <p className="mt-6 text-sm"><Link href="/higher-education/washington" className={LINK}>All Washington colleges</Link></p>
    </SeoPage>
  )
}

export function PublicLookRecruiter() {
  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Search firms', path: '/search-firms' }, { name: 'Northwind Search Partners', path: '/search-firms/northwind-search-partners' }]}
      h1="Northwind Search Partners"
      lede={<>An executive search firm in Chicago, IL, working in finance and operations roles.{claim('Is this your firm?')}</>}
    >
      <section aria-labelledby="firm" className="mt-10">
        <h2 id="firm" className={H2}>What we know about the firm</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="26" label="open searches seen this quarter" />
          <Stat value="Finance" label="most common function" />
          <Stat value="$150K+" label="typical pay range" />
          <Stat value="9" label="recruiters on the team" />
        </ul>
      </section>
      <ActionBand title="Claim your firm's page" body="Correct the details, add your searches and reach candidates directly. It is free." label="Claim this page" href="/recruiters/signup" event="org_page_claim_clicked" properties={{ kind: 'SEARCH_FIRM' }} />
    </SeoPage>
  )
}
