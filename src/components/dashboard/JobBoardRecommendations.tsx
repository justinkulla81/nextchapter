import { GENERAL_JOB_BOARDS, getIndustryJobBoards } from '@/lib/constants/industry-job-boards'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'

export function JobBoardRecommendations({ targetIndustries }: { targetIndustries: string[] }) {
  const industryBoards = getIndustryJobBoards(targetIndustries)

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Where to search</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start broad, then check the boards tailored to your industry below.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {GENERAL_JOB_BOARDS.map((board) => (
          <OutboundPartnerLink
            key={board.name}
            href={board.url}
            partnerName={board.name}
            section="job_board_recommendations"
            className="rounded-full border border-border bg-off-white px-3 py-1 text-sm font-medium text-foreground hover:border-brand/40"
          >
            {board.name}
          </OutboundPartnerLink>
        ))}
      </div>
      {industryBoards.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Job boards tailored for your industry
          </p>
          <div className="flex flex-wrap gap-2">
            {industryBoards.map((board) => (
              <OutboundPartnerLink
                key={board.name}
                href={board.url}
                partnerName={board.name}
                section="job_board_recommendations"
                className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-sm font-medium text-brand hover:border-brand/60"
              >
                {board.name}
              </OutboundPartnerLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
