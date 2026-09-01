import type { CandidateStakeholderNote } from '@prisma/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatAdminDateTime } from '@/lib/admin/format-date'

// Shared across every Relationships sub-tab (Coach/Recruiter/Employer/
// Outplacement/Alumni Org) — the one reusable notes UI over
// CandidateStakeholderNote, per that model's own "one model, not a bespoke
// field per relationship" design.
export function StakeholderNotesCard({
  notes,
  addNoteAction,
}: {
  notes: CandidateStakeholderNote[]
  addNoteAction: (formData: FormData) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes ({notes.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border border-border p-3">
                <p className="whitespace-pre-wrap text-foreground">{note.body}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {note.authorAdminEmail} · {formatAdminDateTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form action={addNoteAction} className="space-y-2">
          <Textarea name="body" placeholder="Add a note…" rows={3} required />
          <SubmitButton size="sm">Add note</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
