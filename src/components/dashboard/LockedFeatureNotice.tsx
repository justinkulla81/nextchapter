import { Lock } from 'lucide-react'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'

// Shared locked-state notice for anything gated on Dossier unlock status —
// always visible with the exact requirement and what's still missing, never
// a silently-disabled control. See design-principles.md: "never disable a
// button without explaining, in-context, why it is disabled." `status` is
// the plain-language reason from isDossierUnlocked() (e.g. "Need: 2 more
// completed references.") — not a letter grade, per §7.1's governing
// principle that the Dossier unlocks on real evidence and effort.
export function LockedFeatureNotice({
  title,
  requirement,
  status,
}: {
  title: string
  requirement: string
  status: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-orange" />
        <p className="text-sm font-medium text-orange">{title} — locked</p>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{requirement}</p>
      <p className="mt-1.5 text-sm font-medium text-foreground">{renderMarkdownLinks(status)}</p>
    </div>
  )
}
