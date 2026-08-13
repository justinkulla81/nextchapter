'use client'

import { useActionState, useState, useTransition } from 'react'
import { Check, X, ChevronDown } from 'lucide-react'
import { toggleToolFamiliarity, addCustomAiTool, removeCustomAiTool, type AddCustomAiToolState } from '@/app/dashboard/learning/actions'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { LogAiProjectForm } from '@/components/dashboard/LogAiProjectForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import type { LearningPlanAiTool, LearningPlanItem } from '@/lib/learning/build-learning-plan'

function ToolCard({ tool }: { tool: LearningPlanAiTool }) {
  const [isFamiliar, setIsFamiliar] = useState(tool.isFamiliar)
  const [removed, setRemoved] = useState(false)
  const [, startTransition] = useTransition()

  if (removed) return null

  return (
    <div className="space-y-1 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <OutboundPartnerLink
          href={tool.url}
          partnerName={tool.name}
          section="ai_tools"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {tool.name}
        </OutboundPartnerLink>
        {tool.isCustom && tool.id && (
          <button
            type="button"
            aria-label={`Remove ${tool.name}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setRemoved(true)
              startTransition(() => {
                removeCustomAiTool(tool.id!)
              })
            }}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{tool.description}</p>
      {!tool.isCustom && (
        <button
          type="button"
          className={
            isFamiliar
              ? 'flex items-center gap-1 text-xs font-medium text-success'
              : 'text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground'
          }
          onClick={() => {
            const next = !isFamiliar
            setIsFamiliar(next)
            startTransition(() => {
              toggleToolFamiliarity(tool.name, next)
            })
          }}
        >
          {isFamiliar ? (
            <>
              <Check className="size-3.5" /> Already know this
            </>
          ) : (
            "I already know this"
          )}
        </button>
      )}
    </div>
  )
}

function AddCustomToolForm() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<AddCustomAiToolState, FormData>(addCustomAiTool, undefined)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add a tool you use
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-4">
      <Input name="toolName" required placeholder="Tool name" className="w-40" />
      <Input name="toolUrl" type="url" placeholder="Link (optional)" className="w-48" />
      <SubmitButton size="sm" pendingLabel="Adding…">
        Add
      </SubmitButton>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

// Replaces the old AiProofPointExercise "guided workflow" card — that
// 3-step exercise was rarely used. Same visual real estate now goes to
// what candidates actually asked for: tools tailored to the role they're
// targeting, a way to mark ones they already know, and a way to add their
// own. The AI-project logging capability isn't gone — it still feeds the
// Dossier's AI Fluency signal — just demoted to a collapsed disclosure
// instead of a featured exercise.
export function ToolsForRoleSection({
  role,
  tools,
  functionTraining,
  completedTitles,
}: {
  role: string | null
  tools: LearningPlanAiTool[]
  functionTraining: LearningPlanItem[]
  completedTitles: Set<string>
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Tools for {role || 'your field'}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Mark the ones you already use, or add a tool that&apos;s not listed.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id ?? tool.name} tool={tool} />
        ))}
      </div>
      <AddCustomToolForm />

      {functionTraining.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-medium text-foreground">Courses & certifications for {role || 'your field'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {functionTraining.map((item) => (
              <LearningResourceCard
                key={item.title}
                item={item}
                section="function_training"
                completed={completedTitles.has(item.title)}
              />
            ))}
          </div>
        </div>
      )}

      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          Built something real with AI recently? Log it as proof.
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3">
          <LogAiProjectForm />
        </div>
      </details>
    </div>
  )
}
