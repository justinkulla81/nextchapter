import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { LogAiProjectForm } from '@/components/dashboard/LogAiProjectForm'
import type { AiToolRecommendation } from '@/lib/constants/ai-tools-by-function'
import type { AiWorkflow } from '@/lib/constants/ai-fluency-workflows'

// The function-specific AI tools list and the guided workflow exercise
// that turns using one of them into a real, loggable proof point — moved
// here from the old page's "Recommended for you" section so it sits next
// to the AI Training tiers instead of buried beside a generic tools list.
export function AiProofPointExercise({
  primaryFunction,
  aiTools,
  aiWorkflow,
}: {
  primaryFunction: string | null
  aiTools: AiToolRecommendation[]
  aiWorkflow: AiWorkflow
}) {
  return (
    <div className="space-y-4">
      {aiTools.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Best AI tools for {primaryFunction || 'your field'}
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {aiTools.map((tool) => (
              <div key={tool.name} className="space-y-1 rounded-lg border border-border p-4">
                <OutboundPartnerLink
                  href={tool.url}
                  partnerName={tool.name}
                  section="ai_tools"
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {tool.name}
                </OutboundPartnerLink>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Guided workflow: {aiWorkflow.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A concrete task you can run today with any AI tool above — finish it and log it as an AI
          project below so it shows up as real proof, not a course completion.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
          {aiWorkflow.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="mt-3">
          <LogAiProjectForm />
        </div>
      </div>
    </div>
  )
}
