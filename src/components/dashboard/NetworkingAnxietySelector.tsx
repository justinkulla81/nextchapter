'use client'

import { useState, useTransition } from 'react'
import type { NetworkingAnxiety } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setNetworkingConcerns } from '@/app/dashboard/network/actions'

const OPTIONS: { value: NetworkingAnxiety; label: string }[] = [
  { value: 'SEEM_DESPERATE', label: "I don't want to seem desperate" },
  { value: 'BURDEN_PEOPLE', label: "I don't want to burden people" },
  { value: 'NOT_SURE_WHAT_TO_SAY', label: "I'm not sure what to say" },
  { value: 'NETWORK_NOT_STRONG', label: "My network isn't strong enough" },
  { value: 'DONT_LIKE_ASKING_FOR_HELP', label: "I don't like asking for help" },
  { value: 'ALREADY_USED_UP_NETWORK', label: "I've already used up my network" },
  { value: 'OTHER', label: 'Something else' },
]

export function NetworkingAnxietySelector({ current }: { current: NetworkingAnxiety[] }) {
  const [selected, setSelected] = useState<NetworkingAnxiety[]>(current)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...current].sort())

  function toggle(value: NetworkingAnxiety) {
    setSaved(false)
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  function handleSave() {
    startTransition(async () => {
      await setNetworkingConcerns(selected)
      setSaved(true)
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        What concerns do you have about reaching out to your network?
      </p>
      <p className="text-sm text-muted-foreground">
        Most job searches are won or lost on this one thing. Pick everything that applies — naming
        the real hesitation is the first step past it. It shapes the outreach scripts below.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={selected.includes(opt.value) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || pending}
          onClick={handleSave}
          className={cn(pending && 'cursor-progress')}
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && !dirty && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </div>
  )
}
