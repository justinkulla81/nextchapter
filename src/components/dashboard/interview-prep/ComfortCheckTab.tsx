'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { updateComfortCheck } from '@/app/dashboard/interview-prep/actions'
import { cn } from '@/lib/utils'

const STOPS = [
  { value: 25, label: 'Not really' },
  { value: 50, label: 'Somewhat' },
  { value: 75, label: 'Mostly' },
  { value: 100, label: 'Completely' },
] as const

function ComfortRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STOPS.map((stop) => (
          <button
            key={stop.value}
            type="button"
            onClick={() => onChange(stop.value)}
            aria-pressed={value === stop.value}
            className={cn(
              'rounded-lg border-2 p-2 text-center text-[11px] leading-snug font-medium transition-colors sm:p-3 sm:text-sm',
              value === stop.value
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-border bg-white text-foreground hover:border-brand/40'
            )}
          >
            {stop.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ComfortCheckTab({
  storyComfort,
  interviewComfort,
  elevatorPitchReady,
}: {
  storyComfort: number | null
  interviewComfort: number | null
  elevatorPitchReady: number | null
}) {
  const [story, setStory] = useState(storyComfort)
  const [interview, setInterview] = useState(interviewComfort)
  const [pitch, setPitch] = useState(elevatorPitchReady)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      await updateComfortCheck({
        storyComfort: story ?? 0,
        interviewComfort: interview ?? 0,
        elevatorPitchReady: pitch ?? 0,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <p className="text-sm text-muted-foreground">
          A quick, honest self-check — no wrong answers. This just helps Victoria know where to
          focus with you.
        </p>
        <ComfortRow
          label="How comfortable are you telling your story out loud?"
          value={story}
          onChange={setStory}
        />
        <ComfortRow
          label="How comfortable do you feel walking into an interview right now?"
          value={interview}
          onChange={setInterview}
        />
        <ComfortRow
          label="Do you have a ready elevator pitch you could give right now?"
          value={pitch}
          onChange={setPitch}
        />
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}
