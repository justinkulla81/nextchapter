import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { NETWORK_CSV_AI_PROMPT_TEMPLATE } from '@/lib/constants/network-ai-prompt-template'

// Bringing a LinkedIn export in, as three plain steps with the reason for each. Replaces the accordion, the bordered
// boxes and the numbered circles joined by a line. The upload form is the same one; the steps open on demand.
export function ImportContacts() {
  return (
    <div id="import" className="scroll-mt-4 space-y-5">
      <p className="max-w-xl text-base text-ink">
        Import your LinkedIn connections once, and we tell you who to write to first. It is safe to upload again any time: new people are added, blanks on existing people are filled in, and anyone you removed stays removed.
      </p>
      <CsvImportForm redesign />
      <details className="group space-y-4">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
          Need to export your connections first?
        </summary>
        <ol className="space-y-5 pt-4">
          <li className="space-y-1">
            <p className="text-base font-semibold text-ink">1. Ask LinkedIn for your connections</p>
            <p className="text-base text-ink">Settings and privacy, then Data privacy, then Get a copy of your data, then Connections, then Request archive. LinkedIn emails you a download link within 10 to 24 minutes.</p>
            <p className="text-sm text-muted-foreground">Why: this brings in everyone you are connected to at once, instead of adding people one at a time.</p>
          </li>
          <li className="space-y-2">
            <p className="text-base font-semibold text-ink">2. Optional: clean it up with AI</p>
            <p className="text-sm text-muted-foreground">Why: your export includes everyone you have ever connected with. This step surfaces the people actually worth writing to first.</p>
            <CopyableTemplateCard
              redesign
              title="Prompt for ChatGPT or Claude"
              description="Paste your exported file into ChatGPT or Claude with this prompt, then upload the cleaned file above."
              template={NETWORK_CSV_AI_PROMPT_TEMPLATE}
              templateType="csv_cleanup_prompt"
            />
          </li>
        </ol>
      </details>
    </div>
  )
}
