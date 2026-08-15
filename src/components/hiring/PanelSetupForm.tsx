'use client'

import { useActionState } from 'react'
import type { HiringCompetencyKey } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/ui/copy-button'
import { COMPETENCY_KEY_LABEL } from '@/lib/hiring/scorecard-constants'
import { createPanelAction, type CandidateActionState } from '@/app/hiring/(app)/candidates/[submissionId]/actions'

const COMPETENCY_ROUND_ROBIN: HiringCompetencyKey[] = ['LEADERSHIP', 'SKILLS_EXECUTION', 'COMMUNICATION', 'ADAPTABILITY', 'OWNERSHIP']

interface ExistingPanelist {
  name: string
  email: string
  assignedCompetency: HiringCompetencyKey | null
  scorecardToken: string
}

// §A8 — "panel coordination assigning each interviewer a different
// competency." Five fixed rows matching the five competencies, one input
// pair each — createPanel (src/lib/hiring/panels.ts) assigns competencies
// by array order, so the labels here just make that assignment visible
// rather than a mystery.
export function PanelSetupForm({ submissionId }: { submissionId: string }) {
  const action = createPanelAction.bind(null, submissionId)
  const [state, formAction, pending] = useActionState<CandidateActionState, FormData>(action, undefined)

  return (
    <form
      action={formAction}
      className={pending ? 'cursor-progress space-y-3 [&_*]:cursor-progress' : 'space-y-3'}
    >
      {COMPETENCY_ROUND_ROBIN.map((key, i) => (
        <div key={key} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr]">
          <p className="self-center text-sm font-medium text-muted-foreground">{COMPETENCY_KEY_LABEL[key]}</p>
          <div className="space-y-1">
            <Label htmlFor={`panelist-name-${i}`} className="sr-only">
              Name
            </Label>
            <Input id={`panelist-name-${i}`} name="panelistName" placeholder="Interviewer name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`panelist-email-${i}`} className="sr-only">
              Email
            </Label>
            <Input id={`panelist-email-${i}`} name="panelistEmail" type="email" placeholder="Email" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Setting up…' : 'Set up panel'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  )
}

export function PanelAssignments({ panelists, siteOrigin }: { panelists: ExistingPanelist[]; siteOrigin: string }) {
  return (
    <div className="space-y-2">
      {panelists.map((p) => (
        <div key={p.scorecardToken} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{p.name}</p>
            <p className="text-muted-foreground">
              {p.email} · {p.assignedCompetency ? COMPETENCY_KEY_LABEL[p.assignedCompetency] : 'No competency assigned'}
            </p>
          </div>
          <CopyButton text={`${siteOrigin}/hiring/scorecard/${p.scorecardToken}`} />
        </div>
      ))}
    </div>
  )
}
