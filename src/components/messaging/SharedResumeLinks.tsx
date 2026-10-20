import { FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

// Résumés the candidate attached in this conversation (native one-click apply),
// shown to the recruiter/employer on the other side. Links are signed for ten
// minutes — the bucket is private — so they're made fresh on every page view.
export async function SharedResumeLinks({
  messages,
}: {
  messages: { attachedResume: { id: string; label: string | null; fileName: string; filePath: string } | null }[]
}) {
  const seen = new Map<string, { label: string | null; fileName: string; filePath: string }>()
  for (const m of messages) if (m.attachedResume && !seen.has(m.attachedResume.id)) seen.set(m.attachedResume.id, m.attachedResume)
  if (seen.size === 0) return null
  const admin = createAdminClient()
  const links = await Promise.all(
    [...seen.values()].map(async (r) => {
      const { data } = await admin.storage.from('resumes').createSignedUrl(r.filePath, 60 * 10)
      return { name: r.label?.trim() || r.fileName, url: data?.signedUrl ?? null }
    })
  )
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <p className="font-medium text-foreground">Résumé shared by the candidate</p>
      <ul className="mt-1 space-y-1">
        {links.map((l) => (
          <li key={l.name} className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" aria-hidden />
            {l.url ? (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                {l.name}
              </a>
            ) : (
              <span className="text-muted-foreground">{l.name} (couldn&apos;t load — refresh the page)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
