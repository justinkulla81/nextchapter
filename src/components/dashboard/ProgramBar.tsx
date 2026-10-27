import { orgProgram, programForCandidate } from '@/lib/employer/program-server'
import { staffProgramsForCandidate } from '@/lib/employer/staff-programs'
import { readableTextOn } from '@/lib/higher-ed/branding'

// The employer's own brand across the top of the dashboard for someone enrolled through their
// company's outplacement program, or its retention or learning and development program for
// current employees (the same idea as the college bar for alumni). Shows only when
// the company has set a look; otherwise nothing, so nobody sees an unbranded strip. Always
// co-marked "with NextChapter", never replacing the NextChapter name.
export async function ProgramBar({ candidateId, className }: { candidateId: string; className?: string }) {
  let program: { name: string; settings: Awaited<ReturnType<typeof orgProgram>>['settings'] } | null = null
  try {
    program = await programForCandidate(candidateId)
    if (!program) {
      const staff = (await staffProgramsForCandidate(candidateId))[0]
      if (staff) program = await orgProgram(staff.orgId)
    }
  } catch (error) {
    console.error('Failed to load employer program bar:', error)
  }
  if (!program) return null
  const { logoUrl, accentColor } = program.settings.brand
  if (!logoUrl && !accentColor) return null
  const bg = accentColor ?? '#2E7D5B'
  return (
    <div className={className} style={{ backgroundColor: bg, color: readableTextOn(bg) }}>
      <div className="flex items-center gap-3 px-6 py-2 text-sm">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${program.name} logo`} className="h-6 w-auto rounded-sm bg-white/90 object-contain p-0.5" />
        )}
        <span className="font-medium">{program.name}</span>
        <span className="opacity-80">with NextChapter</span>
      </div>
    </div>
  )
}
