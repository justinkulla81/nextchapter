import { PreviewShell } from '@/components/candidate/PreviewShell'
import { AdvisoryBoards } from '@/components/network/AdvisoryBoards'

export function AdvisoryBoardsNone() {
  return (
    <PreviewShell place="network" entry="found">
      <AdvisoryBoards journeyDetails={{}} hasCoach={false} coachHref="/dashboard/coaching-match" />
    </PreviewShell>
  )
}

export function AdvisoryBoardsAdvisory() {
  return (
    <PreviewShell place="network" entry="found">
      <AdvisoryBoards journeyDetails={{ boardExperience: 'ADVISORY', boardSectors: 'health, education' }} hasCoach={false} coachHref="/dashboard/coaching-match" />
    </PreviewShell>
  )
}
