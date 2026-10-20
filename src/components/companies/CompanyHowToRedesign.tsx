import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import { EmptyNote, SectionBlock } from '@/components/candidate/Blocks'
import { MarkHelpfulButton, SubmitIntelForm } from '@/components/companies/CompanyIntelControls'
import { INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/intel-types'

const TENURE_LABEL: Record<string, string> = {
  current: 'A current employee',
  within_2yrs: 'left within 2 years',
  '2_5yrs': 'left 2-5 years ago',
  '5yrs_plus': 'left 5+ years ago',
}

export interface HowToIntel {
  id: string
  intelType: string
  body: string
  roleLevelAtTime: string | null
  recencyBucket: string | null
  helpfulCount: number
}

// "How to get hired here" in the redesign: what members say to expect, one serif heading per piece of guidance, and the
// form to add yours. The legacy page keeps its accordion.
export function CompanyHowToRedesign({ companyId, slug, intel }: { companyId: string; slug: string; intel: HowToIntel[] }) {
  return (
    <SectionBlock id="howto-h" title="How to get hired here" why="What members who went through the process here say to expect and prepare for.">
      {intel.length === 0 ? (
        <EmptyNote>No guidance yet. Be the first to share what the interview process here is really like.</EmptyNote>
      ) : (
        <ShowMoreList pageSize={5}>
          {intel.map((i) => (
            <div key={i.id} className="space-y-1.5 border-b border-border py-4 first:pt-0">
              <h3 className="font-display text-lg font-semibold text-ink">{INTEL_TYPE_LABEL[i.intelType as IntelType]}</h3>
              <p className="max-w-2xl text-base text-ink">{i.body}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-sm text-muted-foreground">
                  {i.roleLevelAtTime ? `A former ${i.roleLevelAtTime}` : 'A member'}
                  {i.recencyBucket ? `, ${TENURE_LABEL[i.recencyBucket] ?? i.recencyBucket}` : ''}. {i.helpfulCount} found this helpful.
                </p>
                <MarkHelpfulButton intelId={i.id} companyPageId={slug} redesign />
              </div>
            </div>
          ))}
        </ShowMoreList>
      )}
      <h3 className="pt-2 font-display text-lg font-semibold text-ink">Share what you know</h3>
      <SubmitIntelForm companyId={companyId} companyPageId={slug} redesign />
    </SectionBlock>
  )
}
