'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { assignMember } from '@/app/i/[slug]/(portal)/caseload-actions'

type Counselor = { id: string; name: string; open: number }

// Assign one member to a counselor or college coach. Up to four people:
// one button each; more: a list and one button (design principles).
export function AssignControl(props: { slug: string; memberId: string; counselors: Counselor[]; source: 'search' | 'checkin_followup'; current?: string | null }) {
  const [pending, start] = useTransition()
  const [pickedId, setPickedId] = useState(props.counselors[0]?.id ?? '')
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null)
  if (!props.counselors.length) return <span className="text-xs text-muted-foreground">Invite a counselor in Admin › Staff to assign caseloads.</span>
  const assign = (counselorId: string) =>
    start(async () => {
      const r = await assignMember(props.slug, props.memberId, counselorId, props.source)
      setResult({ text: r.error ?? r.message ?? 'Done.', error: !!r.error })
    })
  if (result && !result.error) return <span role="status" className="text-xs text-muted-foreground">{result.text}</span>
  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      {props.current && <span className="text-xs text-muted-foreground">With {props.current}. Move to:</span>}
      {props.counselors.length <= 4 ? (
        props.counselors.map((c) => (
          <Button key={c.id} size="sm" variant="outline" disabled={pending} onClick={() => assign(c.id)}>
            Assign to {c.name.split(' ')[0]}
          </Button>
        ))
      ) : (
        <>
          <label className="sr-only" htmlFor={`assign-${props.memberId}`}>
            Counselor
          </label>
          <select id={`assign-${props.memberId}`} value={pickedId} onChange={(e) => setPickedId(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {props.counselors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.open} open)
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={pending || !pickedId} onClick={() => assign(pickedId)}>
            Assign
          </Button>
        </>
      )}
      {result?.error && (
        <span role="alert" className="text-xs text-destructive">
          {result.text}
        </span>
      )}
    </div>
  )
}
