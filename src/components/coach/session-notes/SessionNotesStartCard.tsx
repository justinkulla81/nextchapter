'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { startSessionNotesAction } from '@/app/support/coach/(app)/clients/[token]/[clientId]/notes/actions'
import { busy, PrimaryAction, StatusLine, useAct } from './controls'

export interface StartCardSession {
  id: string
  dateLabel: string
  state: 'NONE' | 'DRAFT' | 'REVIEWED' | 'SENT'
  captures: number
}

const STATE_LABEL: Record<StartCardSession['state'], string> = {
  NONE: 'Notes started',
  DRAFT: 'Draft, not sent',
  REVIEWED: 'Edited, not sent',
  SENT: 'Sent',
}

// Replaces the old "Log this session" card on the pre-session brief: one action to start the notes for a session
// that is happening now, and the sessions already started, each with where it stands. The dimension form it used to
// show is still on the page, below, for the structured tracking.
export function SessionNotesStartCard({ token, clientId, firstName, sessions }: { token: string; clientId: string; firstName: string; sessions: StartCardSession[] }) {
  const { pending, notice, act } = useAct()
  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', busy(pending))}>
      <p className="text-sm font-medium text-muted-foreground">Session notes</p>
      <p className="text-sm text-foreground">Capture wins, blockers, decisions and next steps as you talk, review a draft summary, and send it to {firstName} when you are ready. Nothing is sent until you press send.</p>
      <PrimaryAction pending={pending} onClick={() => act(() => startSessionNotesAction(token, clientId))}>Start notes for this session</PrimaryAction>
      <StatusLine notice={notice} />
      {sessions.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span className="text-foreground">{s.dateLabel} · <span className="text-muted-foreground">{STATE_LABEL[s.state]}{s.captures > 0 ? ` · ${s.captures} capture${s.captures === 1 ? '' : 's'}` : ''}</span></span>
              <Link href={`/support/coach/clients/${token}/${clientId}/notes/${s.id}`} className="font-medium text-brand underline underline-offset-4">{s.state === 'SENT' ? 'View notes' : 'Open notes'}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
