'use client'

import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'
import { NextStepBox } from '@/components/capture/NextStepBox'
import { WorkforceBoardPanel } from '@/components/workforce/WorkforceBoardPanel'
import { BoardConnectOffer } from '@/components/onboarding/bundles/BoardConnectOffer'

// Sample data: the situation choice on a place page (state band) and on a board page (navy box), the onboarding Where step's
// board offer, and the privacy settings' board controls.
export function WorkforceSituations() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 bg-off-white p-6">
      <section>
        <p className="mb-2 text-xs uppercase text-muted-foreground">Place page band (Franklin County, OH)</p>
        <OrgCandidateBand orgName="Ohio" branded={false} peopleCount={null} heading="Looking for work in Ohio? See where you stand." properties={{ kind: 'STATE' }} situations={{ state: 'OH', area: 'Franklin County', boardId: 'OH-123', slug: 'place_ohio-franklin', page: 'place' }} />
      </section>
      <section style={{ ['--org-1' as string]: '#e4002b', ['--org-1-ink' as string]: '#ffffff', ['--org-1-text' as string]: '#c40025', ['--org-1-soft' as string]: '#fce1e6' }}>
        <p className="mb-2 text-xs uppercase text-muted-foreground">Workforce board page band, in a board&apos;s colors</p>
        <OrgCandidateBand orgName="Central Ohio Workforce Board" branded peopleCount={14} properties={{ kind: 'WORKFORCE_BOARD' }} situations={{ state: 'OH', area: 'Columbus', boardId: 'OH-123', slug: 'board_sample', page: 'board' }} />
      </section>
      <section>
        <p className="mb-2 text-xs uppercase text-muted-foreground">Workforce board page box</p>
        <NextStepBox audience="seeker" slug="workforce_board_sample" situations={{ state: 'OH', area: 'Columbus', boardId: 'OH-123', slug: 'workforce_board_sample', page: 'board' }} />
      </section>
      <section className="max-w-xl rounded-2xl bg-white p-6">
        <p className="mb-2 text-xs uppercase text-muted-foreground">Onboarding Where step, under the questions</p>
        <BoardConnectOffer boardId="OH-123" boardName="Central Ohio Workforce Board" />
      </section>
      <section className="max-w-xl rounded-2xl bg-white p-6">
        <p className="mb-2 text-xs uppercase text-muted-foreground">Privacy settings: Workforce boards</p>
        <WorkforceBoardPanel variant="privacy" boards={[]} connections={[{ boardId: 'OH-123', name: 'Central Ohio Workforce Board', shareOutcome: false, shareIdentity: false }]} />
      </section>
    </div>
  )
}
